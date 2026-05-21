import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Module, AdapterRegistry, EcosystemAdapter, ManifestResult } from '@deckgraph/shared';
import type { ScanResult } from '../../scanner/scanner.js';
import type { FileChangeEvent } from '../../watcher/fileWatcher.js';

vi.mock('../../config/configLoader.js', () => ({
  loadConfig: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../discovery/moduleDiscovery.js', () => ({
  discoverModules: vi.fn(() => Promise.resolve([])),
  DEFAULT_IGNORE_PATTERNS: [],
}));

vi.mock('../../graph/dependencyGraph.js', () => ({
  buildGraph: vi.fn(() => ({
    modules: new Map(),
    forwardEdges: new Map(),
    reverseEdges: new Map(),
    crossEdges: [],
  })),
}));

vi.mock('../../concern/index.js', () => ({
  tagDependencies: vi.fn((modules: readonly Module[]) => modules),
}));

vi.mock('../../crosslang/index.js', () => ({
  detectCrossEdges: vi.fn(() => Promise.resolve([])),
}));

import { incrementalScan } from '../../scanner/incrementalScanner.js';
import { discoverModules } from '../../discovery/moduleDiscovery.js';

const mockAdapter: EcosystemAdapter = {
  parseManifests: vi.fn((_root: string, modulePath: string): Promise<ManifestResult> => {
    return Promise.resolve({
      moduleName: modulePath.split('/').pop() ?? modulePath,
      dependencies: [{ name: 'dep-a', version: '1.0.0', constraint: '^1.0.0', scope: 'runtime' }],
      hasLockFile: false,
      metadata: {},
    });
  }),
  analyzeImports: vi.fn(),
  queryRegistry: vi.fn(),
};

const mockRegistry: AdapterRegistry = {
  getAdapterForManifest: vi.fn(() => mockAdapter),
  getAdapterForExtension: vi.fn(() => null),
  getRegisteredEcosystems: vi.fn(() => ['npm']),
};

function makeModule(path: string, name: string): Module {
  return {
    path,
    name,
    ecosystem: 'npm',
    manifests: [`${path}/package.json`],
    dependencies: [
      { name: 'dep-a', version: '1.0.0', constraint: '^1.0.0', scope: 'runtime', ecosystem: 'npm', source: 'manifest', concerns: [], usedInFiles: null, transitiveDeps: null, registryMeta: null },
    ],
    analysisState: 'imports-resolved',
  };
}

function makePreviousResult(): ScanResult {
  return {
    project: {
      root: '/test',
      config: null,
      modules: [
        makeModule('services/api', 'api-gateway'),
        makeModule('services/auth', 'auth-service'),
      ],
      crossEdges: [],
      lastScannedAt: '2024-01-01T00:00:00.000Z',
    },
    graph: {
      modules: new Map(),
      forwardEdges: new Map(),
      reverseEdges: new Map(),
      crossEdges: [],
    },
  };
}

describe('incrementalScanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should re-parse only affected modules', async () => {
    const prev = makePreviousResult();
    const event: FileChangeEvent = {
      changedFiles: ['services/api/src/index.ts'],
      addedFiles: [],
      removedFiles: [],
      affectedModules: ['services/api'],
    };

    vi.mocked(discoverModules).mockResolvedValue([
      { path: 'services/api', ecosystem: 'npm', manifests: ['services/api/package.json'] },
      { path: 'services/auth', ecosystem: 'npm', manifests: ['services/auth/package.json'] },
    ]);

    const result = await incrementalScan({
      projectRoot: '/test',
      previousResult: prev,
      event,
      registry: mockRegistry,
    });

    // Both modules should be present
    expect(result.project.modules).toHaveLength(2);

    // Source changes may alter imports, so analysis must be re-run
    const apiModule = result.project.modules.find((m) => m.path === 'services/api');
    expect(apiModule?.analysisState).toBe('manifest-only');

    // The unchanged module should retain its previous state
    const authModule = result.project.modules.find((m) => m.path === 'services/auth');
    expect(authModule?.analysisState).toBe('imports-resolved');
  });

  it('should preserve analysisState for manifest changes when deps are unchanged', async () => {
    const prev = makePreviousResult();
    const event: FileChangeEvent = {
      changedFiles: ['services/api/package.json'],
      addedFiles: [],
      removedFiles: [],
      affectedModules: ['services/api'],
    };

    vi.mocked(discoverModules).mockResolvedValue([
      { path: 'services/api', ecosystem: 'npm', manifests: ['package.json'] },
      { path: 'services/auth', ecosystem: 'npm', manifests: ['package.json'] },
    ]);

    const result = await incrementalScan({
      projectRoot: '/test',
      previousResult: prev,
      event,
      registry: mockRegistry,
    });

    const apiModule = result.project.modules.find((m) => m.path === 'services/api');
    expect(apiModule?.analysisState).toBe('imports-resolved');
  });

  it('should downgrade analysisState when deps change', async () => {
    const prev = makePreviousResult();
    const event: FileChangeEvent = {
      changedFiles: ['services/api/package.json'],
      addedFiles: [],
      removedFiles: [],
      affectedModules: ['services/api'],
    };

    // Return different deps than the previous module
    const changedAdapter: EcosystemAdapter = {
      parseManifests: vi.fn(() =>
        Promise.resolve({
          moduleName: 'api',
          dependencies: [{ name: 'dep-b', version: '2.0.0', constraint: '^2.0.0', scope: 'runtime' }],
          hasLockFile: false,
          metadata: {},
        }),
      ),
      analyzeImports: vi.fn(),
      queryRegistry: vi.fn(),
    };

    const changedRegistry: AdapterRegistry = {
      getAdapterForManifest: vi.fn(() => changedAdapter),
      getAdapterForExtension: vi.fn(() => null),
      getRegisteredEcosystems: vi.fn(() => ['npm']),
    };

    vi.mocked(discoverModules).mockResolvedValue([
      { path: 'services/api', ecosystem: 'npm', manifests: ['services/api/package.json'] },
      { path: 'services/auth', ecosystem: 'npm', manifests: ['services/auth/package.json'] },
    ]);

    const result = await incrementalScan({
      projectRoot: '/test',
      previousResult: prev,
      event,
      registry: changedRegistry,
    });

    // Changed deps should downgrade to manifest-only
    const apiModule = result.project.modules.find((m) => m.path === 'services/api');
    expect(apiModule?.analysisState).toBe('manifest-only');

    // Unchanged module keeps its state
    const authModule = result.project.modules.find((m) => m.path === 'services/auth');
    expect(authModule?.analysisState).toBe('imports-resolved');
  });

  it('should handle new modules appearing', async () => {
    const prev = makePreviousResult();
    const event: FileChangeEvent = {
      changedFiles: [],
      addedFiles: ['services/new/package.json'],
      removedFiles: [],
      affectedModules: [],
    };

    vi.mocked(discoverModules).mockResolvedValue([
      { path: 'services/api', ecosystem: 'npm', manifests: ['services/api/package.json'] },
      { path: 'services/auth', ecosystem: 'npm', manifests: ['services/auth/package.json'] },
      { path: 'services/new', ecosystem: 'npm', manifests: ['services/new/package.json'] },
    ]);

    const result = await incrementalScan({
      projectRoot: '/test',
      previousResult: prev,
      event,
      registry: mockRegistry,
    });

    // All 3 modules should be present (structural change triggers full re-parse)
    expect(result.project.modules.length).toBeGreaterThanOrEqual(3);
  });

  it('should handle removed modules', async () => {
    const prev = makePreviousResult();
    const event: FileChangeEvent = {
      changedFiles: [],
      addedFiles: [],
      removedFiles: ['services/auth/package.json'],
      affectedModules: ['services/auth'],
    };

    vi.mocked(discoverModules).mockResolvedValue([
      { path: 'services/api', ecosystem: 'npm', manifests: ['services/api/package.json'] },
      // services/auth is no longer discovered
    ]);

    const result = await incrementalScan({
      projectRoot: '/test',
      previousResult: prev,
      event,
      registry: mockRegistry,
    });

    // Only api should remain
    const paths = result.project.modules.map((m) => m.path);
    expect(paths).toContain('services/api');
    expect(paths).not.toContain('services/auth');
  });

  it('should return a fresh ScanResult (not mutate previous)', async () => {
    const prev = makePreviousResult();
    const originalModuleCount = prev.project.modules.length;

    const event: FileChangeEvent = {
      changedFiles: ['services/api/src/index.ts'],
      addedFiles: [],
      removedFiles: [],
      affectedModules: ['services/api'],
    };

    vi.mocked(discoverModules).mockResolvedValue([
      { path: 'services/api', ecosystem: 'npm', manifests: ['services/api/package.json'] },
      { path: 'services/auth', ecosystem: 'npm', manifests: ['services/auth/package.json'] },
    ]);

    const result = await incrementalScan({
      projectRoot: '/test',
      previousResult: prev,
      event,
      registry: mockRegistry,
    });

    // Previous should not be mutated
    expect(prev.project.modules).toHaveLength(originalModuleCount);
    // Result should be a different object
    expect(result).not.toBe(prev);
    expect(result.project).not.toBe(prev.project);
  });
});
