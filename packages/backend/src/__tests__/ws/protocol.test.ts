/**
 * Tests for WebSocket protocol message routing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ServerMessage, ErrorMessage, ViewResult, ViewSummary } from '@deckgraph/shared';
import type { ClientConnection, ProgressEmitter, ServerState } from '../../ws/types.js';
import type { ScanResult } from '../../scanner/scanner.js';

vi.mock('../../scanner/scanner.js', () => ({
  scanProject: vi.fn(),
}));

vi.mock('../../graph/queryEngine.js', () => ({
  executeQuery: vi.fn(),
}));

import { scanProject } from '../../scanner/scanner.js';
import { executeQuery } from '../../graph/queryEngine.js';
import { handleMessage } from '../../ws/protocol.js';

const mockScanProject = vi.mocked(scanProject);
const mockExecuteQuery = vi.mocked(executeQuery);

function createMockConnection(): ClientConnection {
  return {
    ws: {} as import('ws').WebSocket,
    clientId: 'test-client',
  };
}

function createMockState(overrides: Partial<ServerState> = {}): ServerState {
  return {
    scanResult: null,
    projectRoot: '/test/project',
    isScanning: false,
    ...overrides,
  };
}

function createMockScanResult(): ScanResult {
  return {
    project: {
      root: '/test/project',
      config: null,
      modules: [
        {
          path: 'packages/app',
          name: 'my-app',
          ecosystem: 'npm' as const,
          manifests: ['package.json'],
          dependencies: [
            {
              name: 'react',
              ecosystem: 'npm' as const,
              version: '18.2.0',
              constraint: '^18.0.0',
              scope: 'runtime' as const,
              source: 'manifest' as const,
              concerns: [],
              usedInFiles: null,
              transitiveDeps: null,
              registryMeta: null,
            },
          ],
          analysisState: 'manifest-only' as const,
        },
      ],
      crossEdges: [],
      lastScannedAt: '2024-01-01T00:00:00.000Z',
    },
    graph: {
      modules: new Map(),
      forward: new Map(),
      reverse: new Map(),
      crossEdges: [],
    },
  };
}

const EMPTY_SUMMARY: ViewSummary = {
  totalDeps: 0,
  byEcosystem: { npm: 0, pypi: 0, cargo: 0, go: 0, maven: 0 },
  byScope: { runtime: 0, dev: 0, build: 0, optional: 0, peer: 0 },
  outdatedCount: null,
  unusedCount: null,
  moduleCount: 0,
  crossEdgeCount: 0,
};

const EMPTY_VIEW_RESULT: ViewResult = {
  modules: [],
  crossEdges: [],
  summary: EMPTY_SUMMARY,
};

describe('handleMessage', () => {
  let connection: ClientConnection;
  let emitProgress: ProgressEmitter;

  beforeEach(() => {
    vi.clearAllMocks();
    connection = createMockConnection();
    emitProgress = vi.fn();
  });

  // ========== Invalid input ==========

  describe('invalid input', () => {
    it('returns error for invalid JSON', async () => {
      const state = createMockState();
      const result = await handleMessage('not-json', connection, state, emitProgress);

      expect(result.type).toBe('error');
      const error = result as ErrorMessage;
      expect(error.requestId).toBe('unknown');
      expect(error.message).toContain('Invalid JSON');
      expect(error.suggestion).toContain('valid JSON');
    });

    it('returns error for unknown message type', async () => {
      const state = createMockState();
      const raw = JSON.stringify({ type: 'unknown_type', requestId: '1' });
      const result = await handleMessage(raw, connection, state, emitProgress);

      expect(result.type).toBe('error');
      const error = result as ErrorMessage;
      expect(error.requestId).toBe('unknown');
      expect(error.suggestion).toContain('scan_project');
    });

    it('returns error for Zod validation failure', async () => {
      const state = createMockState();
      // Missing requestId
      const raw = JSON.stringify({ type: 'scan_project' });
      const result = await handleMessage(raw, connection, state, emitProgress);

      expect(result.type).toBe('error');
      const error = result as ErrorMessage;
      expect(error.requestId).toBe('unknown');
    });

    it('returns error for empty string requestId', async () => {
      const state = createMockState();
      const raw = JSON.stringify({ type: 'scan_project', requestId: '' });
      const result = await handleMessage(raw, connection, state, emitProgress);

      expect(result.type).toBe('error');
    });
  });

  // ========== scan_project ==========

  describe('scan_project', () => {
    it('calls scanner and returns project_overview', async () => {
      const state = createMockState();
      const scanResult = createMockScanResult();
      mockScanProject.mockResolvedValue(scanResult);

      const raw = JSON.stringify({ type: 'scan_project', requestId: 'r1' });
      const result = await handleMessage(raw, connection, state, emitProgress);

      expect(result.type).toBe('project_overview');
      expect(mockScanProject).toHaveBeenCalledWith({
        projectRoot: '/test/project',
      });
      expect(state.scanResult).toBe(scanResult);
    });

    it('emits progress before and after scan', async () => {
      const state = createMockState();
      mockScanProject.mockResolvedValue(createMockScanResult());

      const raw = JSON.stringify({ type: 'scan_project', requestId: 'r1' });
      await handleMessage(raw, connection, state, emitProgress);

      expect(emitProgress).toHaveBeenCalledWith('r1', 'Starting project scan...', 0);
      expect(emitProgress).toHaveBeenCalledWith('r1', 'Scan complete', 1);
    });

    it('returns error when scan is already in progress', async () => {
      const state = createMockState({ isScanning: true });

      const raw = JSON.stringify({ type: 'scan_project', requestId: 'r1' });
      const result = await handleMessage(raw, connection, state, emitProgress);

      expect(result.type).toBe('error');
      const error = result as ErrorMessage;
      expect(error.requestId).toBe('r1');
      expect(error.message).toContain('already in progress');
    });

    it('returns error and resets isScanning when scanner throws', async () => {
      const state = createMockState();
      mockScanProject.mockRejectedValue(new Error('disk full'));

      const raw = JSON.stringify({ type: 'scan_project', requestId: 'r1' });
      const result = await handleMessage(raw, connection, state, emitProgress);

      expect(result.type).toBe('error');
      const error = result as ErrorMessage;
      expect(error.requestId).toBe('r1');
      expect(error.message).not.toContain('disk full'); // no stack trace leak
      expect(state.isScanning).toBe(false);
    });

    it('does not leak stack traces in error messages', async () => {
      const state = createMockState();
      mockScanProject.mockRejectedValue(new Error('ENOENT: no such file'));

      const raw = JSON.stringify({ type: 'scan_project', requestId: 'r1' });
      const result = (await handleMessage(
        raw,
        connection,
        state,
        emitProgress,
      )) as ErrorMessage;

      expect(result.message).not.toContain('ENOENT');
      expect(result.message).not.toContain('stack');
    });
  });

  // ========== view_query ==========

  describe('view_query', () => {
    it('returns view_result when scan data exists', async () => {
      const scanResult = createMockScanResult();
      const state = createMockState({ scanResult });
      mockExecuteQuery.mockReturnValue(EMPTY_VIEW_RESULT);

      const raw = JSON.stringify({
        type: 'view_query',
        requestId: 'r2',
        query: { ecosystems: ['npm'] },
      });
      const result = await handleMessage(raw, connection, state, emitProgress);

      expect(result.type).toBe('view_result');
      expect(mockExecuteQuery).toHaveBeenCalledWith(scanResult.graph, {
        ecosystems: ['npm'],
      });
    });

    it('returns error when no scan data', async () => {
      const state = createMockState();

      const raw = JSON.stringify({
        type: 'view_query',
        requestId: 'r2',
        query: {},
      });
      const result = await handleMessage(raw, connection, state, emitProgress);

      expect(result.type).toBe('error');
      const error = result as ErrorMessage;
      expect(error.requestId).toBe('r2');
      expect(error.suggestion).toContain('scan_project');
    });
  });

  // ========== sync ==========

  describe('sync', () => {
    it('returns project_overview when scan data exists', async () => {
      const scanResult = createMockScanResult();
      const state = createMockState({ scanResult });

      const raw = JSON.stringify({ type: 'sync', requestId: 'r3' });
      const result = await handleMessage(raw, connection, state, emitProgress);

      expect(result.type).toBe('project_overview');
      if (result.type === 'project_overview') {
        expect(result.data).toBe(scanResult.project);
      }
    });

    it('returns error when no scan data', async () => {
      const state = createMockState();

      const raw = JSON.stringify({ type: 'sync', requestId: 'r3' });
      const result = await handleMessage(raw, connection, state, emitProgress);

      expect(result.type).toBe('error');
      const error = result as ErrorMessage;
      expect(error.requestId).toBe('r3');
      expect(error.suggestion).toContain('scan_project');
    });
  });

  // ========== Phase 2 stubs ==========

  describe('phase 2 stubs', () => {
    it('analyze_imports returns not-yet-available error', async () => {
      const state = createMockState();

      const raw = JSON.stringify({
        type: 'analyze_imports',
        requestId: 'r4',
        modulePath: 'packages/backend',
      });
      const result = await handleMessage(raw, connection, state, emitProgress);

      expect(result.type).toBe('error');
      const error = result as ErrorMessage;
      expect(error.requestId).toBe('r4');
      expect(error.message).toContain('not yet available');
    });

    it('enrich_dependency returns not-yet-available error', async () => {
      const state = createMockState();

      const raw = JSON.stringify({
        type: 'enrich_dependency',
        requestId: 'r5',
        ecosystem: 'npm',
        packageName: 'react',
      });
      const result = await handleMessage(raw, connection, state, emitProgress);

      expect(result.type).toBe('error');
      const error = result as ErrorMessage;
      expect(error.requestId).toBe('r5');
      expect(error.message).toContain('not yet available');
    });
  });
});
