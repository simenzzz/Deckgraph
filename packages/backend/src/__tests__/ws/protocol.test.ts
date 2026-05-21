/**
 * Tests for WebSocket protocol message routing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ServerMessage, ErrorMessage, ViewResult, ViewSummary } from '@deckgraph/shared';
import type { ClientConnection, ProgressEmitter, ServerState } from '../../ws/types.js';
import type { ScanResult } from '../../scanner/scanner.js';
import { createAdapterRegistry } from '../../adapters/registry.js';
import { createImportPackageMap } from '../../adapters/importPackageMap.js';
import { createRegistryCache } from '../../adapters/registryCache.js';
import { createRegistryRateLimiter } from '../../adapters/registryRateLimiter.js';

vi.mock('../../scanner/scanner.js', () => ({
  scanProject: vi.fn(),
}));

vi.mock('../../graph/queryEngine.js', () => ({
  executeQuery: vi.fn(),
}));

vi.mock('../../analysis/importResolver.js', () => ({
  resolveImports: vi.fn(),
}));

vi.mock('../../ws/demoRepository.js', () => ({
  importDemoRepository: vi.fn(),
}));

import { scanProject } from '../../scanner/scanner.js';
import { executeQuery } from '../../graph/queryEngine.js';
import { resolveImports } from '../../analysis/importResolver.js';
import { importDemoRepository } from '../../ws/demoRepository.js';
import { handleMessage } from '../../ws/protocol.js';

const mockScanProject = vi.mocked(scanProject);
const mockExecuteQuery = vi.mocked(executeQuery);
const mockResolveImports = vi.mocked(resolveImports);
const mockImportDemoRepository = vi.mocked(importDemoRepository);

function createMockConnection(): ClientConnection {
  return {
    ws: {} as import('ws').WebSocket,
    clientId: 'test-client',
    scanResult: null,
    projectRoot: null,
    demoImportRequestId: null,
  };
}

function createMockState(overrides: Partial<ServerState> = {}): ServerState {
  return {
    scanResult: null,
    projectRoot: '/test/project',
    isScanning: false,
    registry: createAdapterRegistry(),
    packageMap: createImportPackageMap(),
    registryCache: createRegistryCache({ maxSize: 10, ttlMs: 60_000 }),
    rateLimiter: createRegistryRateLimiter(),
    fileWatcher: null,
    fileWatchers: new Map(),
    workspaceScanResult: null,
    workspaceConfig: null,
    executorRegistry: new Map(),
    moduleActionLocks: new Map(),
    demoMode: false,
    demoRepositories: [],
    demoCacheDir: '/tmp/deckgraph-demo-cache',
    ...overrides,
  };
}

function createMockScanResult(root = '/test/project'): ScanResult {
  return {
    project: {
      root,
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
      expect(error.message).toContain('scan_project');
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

  // ========== import_demo_repo ==========

  describe('import_demo_repo', () => {
    it('imports a curated repository and stores scan data on the connection', async () => {
      const scanResult = createMockScanResult();
      const state = createMockState({
        demoMode: true,
        demoRepositories: [{
          id: 'deckgraph-fixture',
          label: 'Deckgraph Fixture',
          url: 'https://github.com/simenzzz/Deckgraph.git',
          description: 'Fixture repo',
        }],
      });

      mockImportDemoRepository.mockResolvedValue({
        repository: state.demoRepositories[0]!,
        path: '/tmp/deckgraph-demo-cache/deckgraph-fixture',
      });
      mockScanProject.mockResolvedValue(scanResult);

      const raw = JSON.stringify({
        type: 'import_demo_repo',
        requestId: 'demo-1',
        repoId: 'deckgraph-fixture',
      });
      const result = await handleMessage(raw, connection, state, emitProgress);

      expect(result.type).toBe('project_overview');
      expect(mockImportDemoRepository).toHaveBeenCalledWith({
        repoId: 'deckgraph-fixture',
        repositories: state.demoRepositories,
        cacheDir: '/tmp/deckgraph-demo-cache',
      });
      expect(mockScanProject).toHaveBeenCalledWith({
        projectRoot: '/tmp/deckgraph-demo-cache/deckgraph-fixture',
      });
      expect(connection.scanResult).toBe(scanResult);
      expect(connection.projectRoot).toBe('/tmp/deckgraph-demo-cache/deckgraph-fixture');
      expect(connection.demoImportRequestId).toBeNull();
      expect(state.scanResult).toBeNull();
    });

    it('preserves previous demo state and sanitizes errors when scan fails', async () => {
      const previousScan = createMockScanResult('/tmp/deckgraph-demo-cache/old');
      connection.scanResult = previousScan;
      connection.projectRoot = '/tmp/deckgraph-demo-cache/old';

      const state = createMockState({
        demoMode: true,
        demoRepositories: [{
          id: 'deckgraph-fixture',
          label: 'Deckgraph Fixture',
          url: 'https://github.com/simenzzz/Deckgraph.git',
          description: 'Fixture repo',
        }],
      });

      mockImportDemoRepository.mockResolvedValue({
        repository: state.demoRepositories[0]!,
        path: '/tmp/deckgraph-demo-cache/deckgraph-fixture',
      });
      mockScanProject.mockRejectedValue(new Error('/tmp/deckgraph-demo-cache/deckgraph-fixture failed'));

      const raw = JSON.stringify({
        type: 'import_demo_repo',
        requestId: 'demo-fail',
        repoId: 'deckgraph-fixture',
      });
      const result = await handleMessage(raw, connection, state, emitProgress);

      expect(result.type).toBe('error');
      const error = result as ErrorMessage;
      expect(error.message).toBe('Demo repository unavailable');
      expect(error.message).not.toContain('/tmp');
      expect(connection.scanResult).toBe(previousScan);
      expect(connection.projectRoot).toBe('/tmp/deckgraph-demo-cache/old');
      expect(connection.demoImportRequestId).toBeNull();
    });

    it('rejects overlapping demo imports for the same connection', async () => {
      connection.demoImportRequestId = 'demo-running';
      const state = createMockState({
        demoMode: true,
        demoRepositories: [{
          id: 'deckgraph-fixture',
          label: 'Deckgraph Fixture',
          url: 'https://github.com/simenzzz/Deckgraph.git',
          description: 'Fixture repo',
        }],
      });

      const raw = JSON.stringify({
        type: 'import_demo_repo',
        requestId: 'demo-next',
        repoId: 'deckgraph-fixture',
      });
      const result = await handleMessage(raw, connection, state, emitProgress);

      expect(result.type).toBe('error');
      const error = result as ErrorMessage;
      expect(error.message).toContain('already in progress');
      expect(mockImportDemoRepository).not.toHaveBeenCalled();
    });

    it('uses connection scan data for demo view queries and sync', async () => {
      const scanResult = createMockScanResult('/tmp/deckgraph-demo-cache/deckgraph-fixture');
      connection.scanResult = scanResult;
      connection.projectRoot = '/tmp/deckgraph-demo-cache/deckgraph-fixture';
      const state = createMockState({ demoMode: true });
      mockExecuteQuery.mockReturnValue(EMPTY_VIEW_RESULT);

      const viewResult = await handleMessage(
        JSON.stringify({
          type: 'view_query',
          requestId: 'demo-view',
          query: { ecosystems: ['npm'] },
        }),
        connection,
        state,
        emitProgress,
      );
      const syncResult = await handleMessage(
        JSON.stringify({ type: 'sync', requestId: 'demo-sync' }),
        connection,
        state,
        emitProgress,
      );

      expect(viewResult.type).toBe('view_result');
      expect(mockExecuteQuery).toHaveBeenCalledWith(scanResult.graph, { ecosystems: ['npm'] });
      expect(syncResult.type).toBe('project_overview');
      if (syncResult.type === 'project_overview') {
        expect(syncResult.data).toBe(scanResult.project);
      }
    });

    it('blocks package mutations in demo mode', async () => {
      const state = createMockState({ demoMode: true, scanResult: createMockScanResult() });

      const raw = JSON.stringify({
        type: 'package_remove',
        requestId: 'demo-2',
        ecosystem: 'npm',
        packageName: 'react',
        modulePath: 'packages/app',
      });
      const result = await handleMessage(raw, connection, state, emitProgress);

      expect(result.type).toBe('error');
      const error = result as ErrorMessage;
      expect(error.message).toContain('read-only');
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

  // ========== analyze_imports ==========

  describe('analyze_imports', () => {
    it('returns error when no scan data', async () => {
      const state = createMockState();

      const raw = JSON.stringify({
        type: 'analyze_imports',
        requestId: 'r4',
        modulePath: 'packages/app',
      });
      const result = await handleMessage(raw, connection, state, emitProgress);

      expect(result.type).toBe('error');
      const error = result as ErrorMessage;
      expect(error.requestId).toBe('r4');
      expect(error.suggestion).toContain('scan_project');
    });

    it('returns error when module not found', async () => {
      const state = createMockState({ scanResult: createMockScanResult() });

      const raw = JSON.stringify({
        type: 'analyze_imports',
        requestId: 'r4',
        modulePath: 'nonexistent/module',
      });
      const result = await handleMessage(raw, connection, state, emitProgress);

      expect(result.type).toBe('error');
      const error = result as ErrorMessage;
      expect(error.message).toContain('Module not found');
    });

    it('returns module_updated on successful analysis', async () => {
      const scanResult = createMockScanResult();
      const state = createMockState({ scanResult });

      const updatedModule = {
        ...scanResult.project.modules[0]!,
        analysisState: 'imports-resolved' as const,
        dependencies: [
          {
            ...scanResult.project.modules[0]!.dependencies[0]!,
            usedInFiles: ['packages/app/src/index.ts'],
            source: 'both' as const,
          },
        ],
      };

      mockResolveImports.mockResolvedValue({
        updatedModule,
        unusedDeps: [],
        importOnlyDeps: [],
      });

      const raw = JSON.stringify({
        type: 'analyze_imports',
        requestId: 'r4',
        modulePath: 'packages/app',
      });
      const result = await handleMessage(raw, connection, state, emitProgress);

      expect(result.type).toBe('module_updated');
      if (result.type === 'module_updated') {
        expect(result.module.analysisState).toBe('imports-resolved');
      }
    });

    it('returns error when module already analyzed', async () => {
      const scanResult = createMockScanResult();
      // Set the module to already analyzed
      (scanResult.project.modules as any)[0].analysisState = 'imports-resolved';
      const state = createMockState({ scanResult });

      const raw = JSON.stringify({
        type: 'analyze_imports',
        requestId: 'r4',
        modulePath: 'packages/app',
      });
      const result = await handleMessage(raw, connection, state, emitProgress);

      expect(result.type).toBe('error');
      const error = result as ErrorMessage;
      expect(error.message).toContain('already analyzed');
    });
  });

  // ========== enrich_dependency ==========

  describe('enrich_dependency', () => {
    it('returns error when no scan data', async () => {
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
      expect(error.suggestion).toContain('scan_project');
    });

    it('returns error when adapter not found for ecosystem', async () => {
      const scanResult = createMockScanResult();
      const state = createMockState({ scanResult });

      const raw = JSON.stringify({
        type: 'enrich_dependency',
        requestId: 'r5',
        ecosystem: 'cargo',
        packageName: 'serde',
      });
      const result = await handleMessage(raw, connection, state, emitProgress);

      expect(result.type).toBe('error');
      const error = result as ErrorMessage;
      expect(error.message).toContain('No adapter registered');
    });

    it('returns error when dependency not in any module', async () => {
      const scanResult = createMockScanResult();
      // Register a mock npm adapter that returns registry data
      const registry = createAdapterRegistry();
      registry.register({
        ecosystem: 'npm',
        manifestFiles: ['package.json'],
        sourceExtensions: ['.js', '.ts'],
        parseManifests: vi.fn(),
        analyzeImports: vi.fn(),
        queryRegistry: vi.fn().mockResolvedValue({
          latestVersion: '19.0.0',
          description: 'A JS library',
          license: 'MIT',
          homepage: null,
          downloads: null,
          deprecated: false,
          publishedAt: null,
        }),
      });
      const state = createMockState({ scanResult, registry });

      const raw = JSON.stringify({
        type: 'enrich_dependency',
        requestId: 'r5',
        ecosystem: 'npm',
        packageName: 'nonexistent-pkg',
      });
      const result = await handleMessage(raw, connection, state, emitProgress);

      expect(result.type).toBe('error');
      const error = result as ErrorMessage;
      expect(error.message).toContain('not found in any scanned module');
    });

    it('returns dependency_enriched on success', async () => {
      const scanResult = createMockScanResult();
      const registry = createAdapterRegistry();
      registry.register({
        ecosystem: 'npm',
        manifestFiles: ['package.json'],
        sourceExtensions: ['.js', '.ts'],
        parseManifests: vi.fn(),
        analyzeImports: vi.fn(),
        queryRegistry: vi.fn().mockResolvedValue({
          latestVersion: '18.3.0',
          description: 'A JavaScript library for building UIs',
          license: 'MIT',
          homepage: 'https://reactjs.org',
          downloads: 1_000_000,
          deprecated: false,
          publishedAt: '2024-01-01T00:00:00Z',
        }),
      });
      const state = createMockState({ scanResult, registry });

      const raw = JSON.stringify({
        type: 'enrich_dependency',
        requestId: 'r5',
        ecosystem: 'npm',
        packageName: 'react',
      });
      const result = await handleMessage(raw, connection, state, emitProgress);

      expect(result.type).toBe('dependency_enriched');
      if (result.type === 'dependency_enriched') {
        expect(result.dependency.name).toBe('react');
        expect(result.dependency.registryMeta).not.toBeNull();
        expect(result.dependency.registryMeta!.latestVersion).toBe('18.3.0');
      }
    });

    it('emits progress during enrichment', async () => {
      const scanResult = createMockScanResult();
      const registry = createAdapterRegistry();
      registry.register({
        ecosystem: 'npm',
        manifestFiles: ['package.json'],
        sourceExtensions: ['.js', '.ts'],
        parseManifests: vi.fn(),
        analyzeImports: vi.fn(),
        queryRegistry: vi.fn().mockResolvedValue({
          latestVersion: '18.3.0',
          description: '',
          license: null,
          homepage: null,
          downloads: null,
          deprecated: false,
          publishedAt: null,
        }),
      });
      const state = createMockState({ scanResult, registry });

      const raw = JSON.stringify({
        type: 'enrich_dependency',
        requestId: 'r5',
        ecosystem: 'npm',
        packageName: 'react',
      });
      await handleMessage(raw, connection, state, emitProgress);

      expect(emitProgress).toHaveBeenCalledWith('r5', expect.stringContaining('npm'), 0);
      expect(emitProgress).toHaveBeenCalledWith('r5', 'Enrichment complete', 1);
    });
  });
});
