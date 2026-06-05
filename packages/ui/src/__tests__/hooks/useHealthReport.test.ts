import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHealthReport } from '@/hooks/useHealthReport';
import { useProjectStore } from '@/stores/projectStore';
import { useFilterStore } from '@/stores/filterStore';
import type { Project, Module, Dependency } from '@deckgraph/shared';

function makeDep(overrides: Partial<Dependency> = {}): Dependency {
  return {
    name: 'test-pkg',
    ecosystem: 'npm',
    version: '1.0.0',
    constraint: '^1',
    scope: 'runtime',
    source: 'manifest',
    concerns: [],
    usedInFiles: null,
    transitiveDeps: null,
    registryMeta: null,
    ...overrides,
  };
}

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

function makeProject(modules: Module[]): Project {
  return {
    root: '/test',
    config: null,
    modules,
    crossEdges: [],
    lastScannedAt: '2024-01-01T00:00:00.000Z',
  };
}

describe('useHealthReport', () => {
  beforeEach(() => {
    useProjectStore.setState({ project: null, isScanning: false, lastProgress: null });
    useFilterStore.setState({ ecosystems: [], scopes: [], search: '', moduleSearch: '', concern: null });
  });

  it('returns empty when no project', () => {
    const { result } = renderHook(() => useHealthReport());
    expect(result.current.outdatedDeps).toEqual([]);
    expect(result.current.unusedDeps).toEqual([]);
    expect(result.current.licenseDistribution).toEqual([]);
    expect(result.current.hasImportAnalysis).toBe(false);
    expect(result.current.hasRegistryData).toBe(false);
  });

  it('detects outdated deps from registry data', () => {
    const project = makeProject([
      makeModule({
        dependencies: [
          makeDep({
            name: 'express',
            version: '4.0.0',
            registryMeta: {
              latestVersion: '5.0.0',
              description: 'Web framework',
              license: 'MIT',
              homepage: null,
              downloads: null,
              deprecated: false,
              publishedAt: null,
            },
          }),
        ],
      }),
    ]);
    useProjectStore.getState().setProject(project);

    const { result } = renderHook(() => useHealthReport());
    expect(result.current.outdatedDeps).toHaveLength(1);
    expect(result.current.outdatedDeps[0].severity).toBe('major-behind');
    expect(result.current.hasRegistryData).toBe(true);
  });

  it('sorts outdated deps by severity (most severe first)', () => {
    const project = makeProject([
      makeModule({
        dependencies: [
          makeDep({
            name: 'minor-pkg',
            version: '1.0.0',
            registryMeta: {
              latestVersion: '1.2.0',
              description: '',
              license: 'MIT',
              homepage: null,
              downloads: null,
              deprecated: false,
              publishedAt: null,
            },
          }),
          makeDep({
            name: 'major-pkg',
            version: '1.0.0',
            registryMeta: {
              latestVersion: '3.0.0',
              description: '',
              license: 'MIT',
              homepage: null,
              downloads: null,
              deprecated: false,
              publishedAt: null,
            },
          }),
        ],
      }),
    ]);
    useProjectStore.getState().setProject(project);

    const { result } = renderHook(() => useHealthReport());
    expect(result.current.outdatedDeps[0].name).toBe('major-pkg');
    expect(result.current.outdatedDeps[1].name).toBe('minor-pkg');
  });

  it('detects unused deps when import analysis is done', () => {
    const project = makeProject([
      makeModule({
        analysisState: 'imports-resolved',
        dependencies: [
          makeDep({ name: 'used-pkg', usedInFiles: ['src/index.ts'] }),
          makeDep({ name: 'unused-pkg', usedInFiles: [] }),
        ],
      }),
    ]);
    useProjectStore.getState().setProject(project);

    const { result } = renderHook(() => useHealthReport());
    expect(result.current.unusedDeps).toHaveLength(1);
    expect(result.current.unusedDeps[0].name).toBe('unused-pkg');
    expect(result.current.hasImportAnalysis).toBe(true);
  });

  it('does not flag unused when analysis not run', () => {
    const project = makeProject([
      makeModule({
        analysisState: 'manifest-only',
        dependencies: [makeDep({ usedInFiles: null })],
      }),
    ]);
    useProjectStore.getState().setProject(project);

    const { result } = renderHook(() => useHealthReport());
    expect(result.current.unusedDeps).toHaveLength(0);
    expect(result.current.hasImportAnalysis).toBe(false);
  });

  it('computes license distribution with copyleft detection', () => {
    const project = makeProject([
      makeModule({
        dependencies: [
          makeDep({
            name: 'mit-pkg',
            registryMeta: {
              latestVersion: '1.0.0',
              description: '',
              license: 'MIT',
              homepage: null,
              downloads: null,
              deprecated: false,
              publishedAt: null,
            },
          }),
          makeDep({
            name: 'gpl-pkg',
            registryMeta: {
              latestVersion: '1.0.0',
              description: '',
              license: 'GPL-3.0',
              homepage: null,
              downloads: null,
              deprecated: false,
              publishedAt: null,
            },
          }),
        ],
      }),
    ]);
    useProjectStore.getState().setProject(project);

    const { result } = renderHook(() => useHealthReport());
    expect(result.current.licenseDistribution).toHaveLength(2);

    const gpl = result.current.licenseDistribution.find((l) => l.license === 'GPL-3.0');
    expect(gpl?.isCopyleft).toBe(true);

    const mit = result.current.licenseDistribution.find((l) => l.license === 'MIT');
    expect(mit?.isCopyleft).toBe(false);
  });

  it('respects ecosystem filter', () => {
    const project = makeProject([
      makeModule({
        dependencies: [
          makeDep({
            name: 'npm-pkg',
            ecosystem: 'npm',
            version: '1.0.0',
            registryMeta: {
              latestVersion: '2.0.0',
              description: '',
              license: 'MIT',
              homepage: null,
              downloads: null,
              deprecated: false,
              publishedAt: null,
            },
          }),
          makeDep({
            name: 'pypi-pkg',
            ecosystem: 'pypi',
            version: '1.0.0',
            registryMeta: {
              latestVersion: '2.0.0',
              description: '',
              license: 'MIT',
              homepage: null,
              downloads: null,
              deprecated: false,
              publishedAt: null,
            },
          }),
        ],
      }),
    ]);
    useProjectStore.getState().setProject(project);
    useFilterStore.getState().toggleEcosystem('npm');

    const { result } = renderHook(() => useHealthReport());
    expect(result.current.outdatedDeps).toHaveLength(1);
    expect(result.current.outdatedDeps[0].name).toBe('npm-pkg');
  });
});
