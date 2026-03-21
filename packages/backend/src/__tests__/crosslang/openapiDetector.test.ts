/**
 * Tests for the OpenAPI cross-language edge detector.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Module } from '@deckgraph/shared';
import { createOpenapiDetector } from '../../crosslang/openapiDetector.js';

vi.mock('../../crosslang/fileScanner.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../crosslang/fileScanner.js')>();
  return { ...actual, findFiles: vi.fn() };
});

vi.mock('../../adapters/utils.js', () => ({
  readFileSafe: vi.fn(),
}));

import { findFiles } from '../../crosslang/fileScanner.js';
import { readFileSafe } from '../../adapters/utils.js';

const mockFindFiles = vi.mocked(findFiles);
const mockReadFileSafe = vi.mocked(readFileSafe);

afterEach(() => {
  vi.restoreAllMocks();
});

function makeModule(overrides: Partial<Module> = {}): Module {
  return {
    path: 'packages/app',
    name: 'app',
    ecosystem: 'npm',
    manifests: ['package.json'],
    dependencies: [],
    analysisState: 'manifest-only',
    ...overrides,
  };
}

describe('openapiDetector', () => {
  const detector = createOpenapiDetector();

  it('returns empty array when no spec files found', async () => {
    mockFindFiles.mockResolvedValue([]);
    const result = await detector.detect('/project', [makeModule()]);
    expect(result).toEqual([]);
  });

  it('detects OpenAPI edges between different ecosystems', async () => {
    mockFindFiles.mockResolvedValue(['services/api/openapi.yaml']);
    mockReadFileSafe.mockResolvedValue(`
openapi: "3.0.0"
info:
  title: User API
  version: "1.0.0"
paths:
  /users:
    get:
      summary: List users
  /users/{id}:
    get:
      summary: Get user
    `);

    const modules: Module[] = [
      makeModule({
        path: 'services/api',
        ecosystem: 'pypi',
      }),
      makeModule({
        path: 'packages/client',
        ecosystem: 'npm',
        dependencies: [
          {
            name: 'axios',
            ecosystem: 'npm',
            version: '1.0.0',
            constraint: '^1.0.0',
            scope: 'runtime',
            source: 'manifest',
            concerns: ['http'],
            usedInFiles: null,
            transitiveDeps: null,
            registryMeta: null,
          },
        ],
      }),
    ];

    const result = await detector.detect('/project', modules);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]!.type).toBe('openapi');
    expect(result[0]!.confidence).toBe(0.7);
    expect(result[0]!.evidence).toContain('User API');
    expect(result[0]!.evidence).toContain('2 paths');
  });

  it('skips same-ecosystem modules', async () => {
    mockFindFiles.mockResolvedValue(['services/api/openapi.yaml']);
    mockReadFileSafe.mockResolvedValue(`
openapi: "3.0.0"
info:
  title: Test API
  version: "1.0.0"
paths:
  /test:
    get:
      summary: Test
    `);

    const modules: Module[] = [
      makeModule({ path: 'services/api', ecosystem: 'npm' }),
      makeModule({
        path: 'packages/client',
        ecosystem: 'npm',
        dependencies: [
          {
            name: 'axios',
            ecosystem: 'npm',
            version: '1.0.0',
            constraint: '^1.0.0',
            scope: 'runtime',
            source: 'manifest',
            concerns: ['http'],
            usedInFiles: null,
            transitiveDeps: null,
            registryMeta: null,
          },
        ],
      }),
    ];

    const result = await detector.detect('/project', modules);
    expect(result).toEqual([]);
  });

  it('handles invalid YAML gracefully', async () => {
    mockFindFiles.mockResolvedValue(['api/openapi.yaml']);
    mockReadFileSafe.mockResolvedValue('invalid: [yaml: {broken');

    const result = await detector.detect('/project', [makeModule()]);
    expect(result).toEqual([]);
  });
});
