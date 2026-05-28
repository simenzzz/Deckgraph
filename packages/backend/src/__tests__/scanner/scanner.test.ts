/**
 * Tests for the project scanner.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import type {
  AdapterRegistry,
  EcosystemAdapter,
  ManifestResult,
  ParsedImport,
  RegistryMeta,
} from '@deckgraph/shared';
import type { DiscoveredModule } from '../../discovery/moduleDiscovery.js';

vi.mock('../../config/configLoader.js', () => ({
  loadConfig: vi.fn(),
}));

vi.mock('../../discovery/moduleDiscovery.js', () => ({
  discoverModules: vi.fn(),
}));

vi.mock('../../adapters/index.js', () => ({
  createDefaultRegistry: vi.fn(),
}));

vi.mock('../../crosslang/index.js', () => ({
  detectCrossEdges: vi.fn(),
}));

import { loadConfig } from '../../config/configLoader.js';
import { discoverModules } from '../../discovery/moduleDiscovery.js';
import { detectCrossEdges } from '../../crosslang/index.js';
import { scanProject } from '../../scanner/scanner.js';

const mockLoadConfig = vi.mocked(loadConfig);
const mockDiscoverModules = vi.mocked(discoverModules);
const mockDetectCrossEdges = vi.mocked(detectCrossEdges);

beforeEach(() => {
  mockDetectCrossEdges.mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function createMockAdapter(
  overrides: Partial<EcosystemAdapter> = {},
): EcosystemAdapter {
  return {
    ecosystem: 'npm',
    manifestFiles: ['package.json'],
    sourceExtensions: ['.ts', '.js'],
    parseManifests: async (): Promise<ManifestResult> => ({
      moduleName: 'test',
      dependencies: [],
      hasLockFile: false,
      metadata: {},
    }),
    analyzeImports: async (): Promise<readonly ParsedImport[]> => [],
    queryRegistry: async (): Promise<RegistryMeta | null> => null,
    ...overrides,
  };
}

function createMockRegistry(
  adapters: Map<string, EcosystemAdapter> = new Map(),
): AdapterRegistry {
  return {
    register: vi.fn(),
    getAdapterForManifest: (fileName: string) => adapters.get(fileName) ?? null,
    getAdapterForExtension: () => null,
    getAdapterForEcosystem: () => null,
    getRegisteredEcosystems: () => [...new Set([...adapters.values()].map((a) => a.ecosystem))],
  };
}

describe('scanProject', () => {
  it('scans an empty project', async () => {
    mockLoadConfig.mockResolvedValue(null);
    mockDiscoverModules.mockResolvedValue([]);

    const { project, graph } = await scanProject({
      projectRoot: '/test/project',
      registry: createMockRegistry(),
    });

    expect(project.root).toBe('/test/project');
    expect(project.config).toBeNull();
    expect(project.modules).toEqual([]);
    expect(project.crossEdges).toEqual([]);
    expect(graph.modules.size).toBe(0);
  });

  it('scans a project with a single module', async () => {
    mockLoadConfig.mockResolvedValue(null);
    const discovered: DiscoveredModule[] = [
      { path: 'packages/app', manifests: ['package.json'], ecosystem: 'npm' },
    ];
    mockDiscoverModules.mockResolvedValue(discovered);

    const adapter = createMockAdapter({
      parseManifests: async () => ({
        moduleName: 'my-app',
        dependencies: [
          { name: 'react', version: '18.2.0', constraint: '^18.0.0', scope: 'runtime' },
          { name: 'vitest', version: '2.0.0', constraint: '^2.0.0', scope: 'dev' },
        ],
        hasLockFile: true,
        metadata: {},
      }),
    });

    const registry = createMockRegistry(new Map([['package.json', adapter]]));

    const { project, graph } = await scanProject({
      projectRoot: '/test/project',
      registry,
    });

    expect(project.modules).toHaveLength(1);
    expect(project.modules[0]!.name).toBe('my-app');
    expect(project.modules[0]!.dependencies).toHaveLength(2);
    expect(project.modules[0]!.analysisState).toBe('manifest-only');

    expect(graph.modules.size).toBe(1);
    expect(graph.forward.get('packages/app')!.size).toBe(2);
  });

  it('scans a project with multiple modules', async () => {
    mockLoadConfig.mockResolvedValue(null);
    const discovered: DiscoveredModule[] = [
      { path: 'packages/app', manifests: ['package.json'], ecosystem: 'npm' },
      { path: 'packages/lib', manifests: ['package.json'], ecosystem: 'npm' },
    ];
    mockDiscoverModules.mockResolvedValue(discovered);

    const adapter = createMockAdapter({
      parseManifests: async (_root, modulePath) => ({
        moduleName: modulePath === 'packages/app' ? 'app' : 'lib',
        dependencies: [
          { name: 'zod', version: '3.22.0', constraint: '^3.22.0', scope: 'runtime' },
        ],
        hasLockFile: false,
        metadata: {},
      }),
    });

    const registry = createMockRegistry(new Map([['package.json', adapter]]));

    const { project, graph } = await scanProject({
      projectRoot: '/test/project',
      registry,
    });

    expect(project.modules).toHaveLength(2);
    expect(graph.modules.size).toBe(2);
    // Both modules depend on zod — check reverse edge
    expect(graph.reverse.get('npm:zod')!.size).toBe(2);
  });

  it('skips modules with no adapter', async () => {
    mockLoadConfig.mockResolvedValue(null);
    const discovered: DiscoveredModule[] = [
      { path: 'services/api', manifests: ['pyproject.toml'], ecosystem: 'pypi' },
    ];
    mockDiscoverModules.mockResolvedValue(discovered);

    // Registry has no adapter for pyproject.toml
    const registry = createMockRegistry();

    const { project } = await scanProject({
      projectRoot: '/test/project',
      registry,
    });

    expect(project.modules).toEqual([]);
  });

  it('skips modules when adapter throws', async () => {
    mockLoadConfig.mockResolvedValue(null);
    const discovered: DiscoveredModule[] = [
      { path: 'packages/broken', manifests: ['package.json'], ecosystem: 'npm' },
    ];
    mockDiscoverModules.mockResolvedValue(discovered);

    const adapter = createMockAdapter({
      parseManifests: async () => {
        throw new Error('corrupt manifest');
      },
    });

    const registry = createMockRegistry(new Map([['package.json', adapter]]));

    const { project } = await scanProject({
      projectRoot: '/test/project',
      registry,
    });

    expect(project.modules).toEqual([]);
  });

  it('converts MinimalDependency to full Dependency', async () => {
    mockLoadConfig.mockResolvedValue(null);
    const discovered: DiscoveredModule[] = [
      { path: 'packages/app', manifests: ['package.json'], ecosystem: 'npm' },
    ];
    mockDiscoverModules.mockResolvedValue(discovered);

    const adapter = createMockAdapter({
      parseManifests: async () => ({
        moduleName: 'app',
        dependencies: [
          { name: 'react', version: '18.2.0', constraint: '^18.0.0', scope: 'runtime' },
        ],
        hasLockFile: false,
        metadata: {},
      }),
    });

    const registry = createMockRegistry(new Map([['package.json', adapter]]));

    const { project } = await scanProject({
      projectRoot: '/test/project',
      registry,
    });

    const dep = project.modules[0]!.dependencies[0]!;
    expect(dep.name).toBe('react');
    expect(dep.ecosystem).toBe('npm');
    expect(dep.version).toBe('18.2.0');
    expect(dep.constraint).toBe('^18.0.0');
    expect(dep.scope).toBe('runtime');
    expect(dep.source).toBe('manifest');
    expect(dep.concerns).toEqual(['ui']);
    expect(dep.usedInFiles).toBeNull();
    expect(dep.transitiveDeps).toBeNull();
    expect(dep.registryMeta).toBeNull();
  });

  it('produces ISO 8601 lastScannedAt', async () => {
    mockLoadConfig.mockResolvedValue(null);
    mockDiscoverModules.mockResolvedValue([]);

    const { project } = await scanProject({
      projectRoot: '/test/project',
      registry: createMockRegistry(),
    });

    // Should parse as a valid date
    const date = new Date(project.lastScannedAt);
    expect(date.getTime()).not.toBeNaN();
    // Should contain 'T' for ISO format
    expect(project.lastScannedAt).toContain('T');
  });

  it('returns crossEdges from detector', async () => {
    mockLoadConfig.mockResolvedValue(null);
    mockDiscoverModules.mockResolvedValue([]);
    mockDetectCrossEdges.mockResolvedValue([]);

    const { project } = await scanProject({
      projectRoot: '/test/project',
      registry: createMockRegistry(),
    });

    expect(project.crossEdges).toEqual([]);
  });

  it('populates concern tags on dependencies', async () => {
    mockLoadConfig.mockResolvedValue(null);
    const discovered: DiscoveredModule[] = [
      { path: 'packages/app', manifests: ['package.json'], ecosystem: 'npm' },
    ];
    mockDiscoverModules.mockResolvedValue(discovered);

    const adapter = createMockAdapter({
      parseManifests: async () => ({
        moduleName: 'app',
        dependencies: [
          { name: 'express', version: '4.18.0', constraint: '^4.18.0', scope: 'runtime' },
        ],
        hasLockFile: false,
        metadata: {},
      }),
    });

    const registry = createMockRegistry(new Map([['package.json', adapter]]));
    const { project } = await scanProject({ projectRoot: '/test/project', registry });

    const dep = project.modules[0]!.dependencies[0]!;
    expect(dep.concerns).toContain('http');
    expect(dep.concerns).toContain('server');
  });

  it('applies concern overrides from config', async () => {
    mockLoadConfig.mockResolvedValue({
      ignorePaths: [],
      concernOverrides: { 'my-pkg': ['custom-tag'] },
    });
    const discovered: DiscoveredModule[] = [
      { path: 'packages/app', manifests: ['package.json'], ecosystem: 'npm' },
    ];
    mockDiscoverModules.mockResolvedValue(discovered);

    const adapter = createMockAdapter({
      parseManifests: async () => ({
        moduleName: 'app',
        dependencies: [
          { name: 'my-pkg', version: '1.0.0', constraint: '^1.0.0', scope: 'runtime' },
        ],
        hasLockFile: false,
        metadata: {},
      }),
    });

    const registry = createMockRegistry(new Map([['package.json', adapter]]));
    const { project } = await scanProject({ projectRoot: '/test/project', registry });

    expect(project.modules[0]!.dependencies[0]!.concerns).toEqual(['custom-tag']);
  });

  it('includes crossEdges on graph', async () => {
    mockLoadConfig.mockResolvedValue(null);
    mockDiscoverModules.mockResolvedValue([]);

    const fakeEdge = {
      from: { module: 'a', ecosystem: 'npm' as const },
      to: { module: 'b', ecosystem: 'pypi' as const },
      type: 'proto' as const,
      evidence: 'test',
      confidence: 0.9,
    };
    mockDetectCrossEdges.mockResolvedValue([fakeEdge]);

    const { project, graph } = await scanProject({
      projectRoot: '/test/project',
      registry: createMockRegistry(),
    });

    expect(project.crossEdges).toHaveLength(1);
    expect(graph.crossEdges).toHaveLength(1);
  });

  it('passes config through', async () => {
    const config = {
      ignorePaths: ['vendor'],
      concernOverrides: { lodash: ['utility'] },
    };
    mockLoadConfig.mockResolvedValue(config);
    mockDiscoverModules.mockResolvedValue([]);

    const { project } = await scanProject({
      projectRoot: '/test/project',
      registry: createMockRegistry(),
    });

    expect(project.config).toEqual(config);
  });

  it('loads config from configRoot and discovers modules under scanRoot', async () => {
    mockLoadConfig.mockResolvedValue({
      ignorePaths: ['fixtures'],
      concernOverrides: {},
    });
    mockDiscoverModules.mockResolvedValue([]);

    await scanProject({
      projectRoot: '/test/repo',
      configRoot: '/test/repo',
      scanRoot: 'packages',
      additionalIgnorePaths: ['docs/archive'],
      registry: createMockRegistry(),
    });

    expect(mockLoadConfig).toHaveBeenCalledWith('/test/repo');
    expect(mockDiscoverModules).toHaveBeenCalledWith(
      '/test/repo',
      {
        ignorePaths: ['fixtures', 'docs/archive'],
        concernOverrides: {},
      },
      { scanRoot: 'packages' },
    );
  });

  it('uses custom registry when provided', async () => {
    mockLoadConfig.mockResolvedValue(null);
    const discovered: DiscoveredModule[] = [
      { path: 'packages/app', manifests: ['package.json'], ecosystem: 'npm' },
    ];
    mockDiscoverModules.mockResolvedValue(discovered);

    const parseSpy = vi.fn().mockResolvedValue({
      moduleName: 'app',
      dependencies: [],
      hasLockFile: false,
      metadata: {},
    });

    const adapter = createMockAdapter({ parseManifests: parseSpy });
    const registry = createMockRegistry(new Map([['package.json', adapter]]));

    await scanProject({ projectRoot: '/test/project', registry });

    expect(parseSpy).toHaveBeenCalledWith('/test/project', 'packages/app');
  });

  it('uses default registry when none provided', async () => {
    const { createDefaultRegistry } = await import('../../adapters/index.js');
    const mockCreateDefaultRegistry = vi.mocked(createDefaultRegistry);

    const adapter = createMockAdapter();
    const registry = createMockRegistry(new Map([['package.json', adapter]]));
    mockCreateDefaultRegistry.mockReturnValue(registry);

    mockLoadConfig.mockResolvedValue(null);
    mockDiscoverModules.mockResolvedValue([]);

    const { project } = await scanProject({ projectRoot: '/test/project' });

    expect(mockCreateDefaultRegistry).toHaveBeenCalled();
    expect(project.root).toBe('/test/project');
  });

  it('handles non-Error thrown by adapter', async () => {
    mockLoadConfig.mockResolvedValue(null);
    const discovered: DiscoveredModule[] = [
      { path: 'packages/broken', manifests: ['package.json'], ecosystem: 'npm' },
    ];
    mockDiscoverModules.mockResolvedValue(discovered);

    const adapter = createMockAdapter({
      parseManifests: async () => {
        throw 'string-error';
      },
    });

    const registry = createMockRegistry(new Map([['package.json', adapter]]));

    const { project } = await scanProject({
      projectRoot: '/test/project',
      registry,
    });

    expect(project.modules).toEqual([]);
  });
});
