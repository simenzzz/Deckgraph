import { describe, expect, it } from 'vitest';
import type { Project } from '@deckgraph/shared';
import { getImportPrereqTargets, getRegistryPrereqTargets } from '@/lib/healthPrerequisites';

const project: Project = {
  root: '/test',
  config: null,
  crossEdges: [],
  lastScannedAt: '2024-01-01T00:00:00.000Z',
  modules: [
    {
      path: 'pkg/a',
      name: 'a',
      ecosystem: 'npm',
      manifests: ['package.json'],
      analysisState: 'manifest-only',
      dependencies: [
        {
          name: 'react',
          ecosystem: 'npm',
          version: '18.0.0',
          constraint: '^18',
          scope: 'runtime',
          source: 'manifest',
          concerns: [],
          usedInFiles: null,
          transitiveDeps: null,
          registryMeta: null,
        },
        {
          name: 'local-lib',
          ecosystem: 'npm',
          version: '1.0.0',
          constraint: 'workspace:*',
          scope: 'runtime',
          source: 'manifest',
          local: true,
          concerns: [],
          usedInFiles: null,
          transitiveDeps: null,
          registryMeta: null,
        },
      ],
    },
    {
      path: 'pkg/b',
      name: 'b',
      ecosystem: 'npm',
      manifests: ['package.json'],
      analysisState: 'imports-resolved',
      dependencies: [
        {
          name: 'react',
          ecosystem: 'npm',
          version: '19.0.0',
          constraint: '^19',
          scope: 'dev',
          source: 'manifest',
          concerns: [],
          usedInFiles: [],
          transitiveDeps: null,
          registryMeta: null,
        },
      ],
    },
    {
      path: 'pkg/c',
      name: 'c',
      ecosystem: 'pypi',
      manifests: ['pyproject.toml'],
      analysisState: 'manifest-only',
      dependencies: [
        {
          name: 'flask',
          ecosystem: 'pypi',
          version: '2.0.0',
          constraint: '^2',
          scope: 'runtime',
          source: 'manifest',
          concerns: [],
          usedInFiles: null,
          transitiveDeps: null,
          registryMeta: {
            latestVersion: '2.0.0',
            description: '',
            license: 'BSD',
            homepage: null,
            downloads: null,
            deprecated: false,
            publishedAt: null,
          },
        },
      ],
    },
  ],
};

describe('health prerequisite target derivation', () => {
  it('dedupes registry targets and excludes local or enriched dependencies', () => {
    const targets = getRegistryPrereqTargets(project, { ecosystems: [], scopes: [] });
    expect(targets).toEqual([
      {
        kind: 'registry',
        targetId: 'npm:react',
        label: 'react',
        ecosystem: 'npm',
        packageName: 'react',
        modulePath: 'pkg/a',
      },
    ]);
  });

  it('honors ecosystem and scope filters for registry targets', () => {
    expect(getRegistryPrereqTargets(project, { ecosystems: ['pypi'], scopes: [] })).toEqual([]);
    expect(getRegistryPrereqTargets(project, { ecosystems: [], scopes: ['dev'] })).toEqual([
      {
        kind: 'registry',
        targetId: 'npm:react',
        label: 'react',
        ecosystem: 'npm',
        packageName: 'react',
        modulePath: 'pkg/b',
      },
    ]);
  });

  it('includes only manifest-only modules with visible dependencies for import targets', () => {
    expect(getImportPrereqTargets(project, { ecosystems: [], scopes: [] })).toEqual([
      { kind: 'imports', targetId: 'pkg/a', label: 'a', modulePath: 'pkg/a' },
      { kind: 'imports', targetId: 'pkg/c', label: 'c', modulePath: 'pkg/c' },
    ]);
    expect(getImportPrereqTargets(project, { ecosystems: ['npm'], scopes: ['dev'] })).toEqual([]);
  });
});
