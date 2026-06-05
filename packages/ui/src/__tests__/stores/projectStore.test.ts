import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '@/stores/projectStore';
import type { Project, Module, ProgressMessage } from '@deckgraph/shared';

const mockModule: Module = {
  path: 'packages/lib',
  name: 'lib',
  ecosystem: 'npm',
  manifests: ['package.json'],
  dependencies: [],
  analysisState: 'manifest-only',
};

const mockProject: Project = {
  root: '/test/project',
  config: null,
  modules: [mockModule],
  crossEdges: [],
  lastScannedAt: '2024-01-01T00:00:00.000Z',
};

describe('projectStore', () => {
  beforeEach(() => {
    useProjectStore.setState({
      project: null,
      isScanning: false,
      lastProgress: null,
      fileChangeInProgress: false,
    });
  });

  it('starts with null project', () => {
    expect(useProjectStore.getState().project).toBeNull();
  });

  it('setProject stores project and clears scanning state', () => {
    useProjectStore.getState().setScanning(true);
    useProjectStore.getState().setProject(mockProject);

    const state = useProjectStore.getState();
    expect(state.project).toEqual(mockProject);
    expect(state.isScanning).toBe(false);
    expect(state.lastProgress).toBeNull();
  });

  it('setScanning updates isScanning', () => {
    useProjectStore.getState().setScanning(true);
    expect(useProjectStore.getState().isScanning).toBe(true);
  });

  it('setProgress stores progress and sets isScanning', () => {
    const progress: ProgressMessage = {
      type: 'progress',
      requestId: 'r1',
      message: 'Scanning...',
      phase: 0,
    };
    useProjectStore.getState().setProgress(progress);

    const state = useProjectStore.getState();
    expect(state.lastProgress).toEqual(progress);
    expect(state.isScanning).toBe(true);
  });

  it('updateModule replaces module by path', () => {
    useProjectStore.getState().setProject(mockProject);

    const updatedModule: Module = {
      ...mockModule,
      analysisState: 'imports-resolved',
    };

    useProjectStore.getState().updateModule(updatedModule);

    const mod = useProjectStore.getState().project?.modules[0];
    expect(mod?.analysisState).toBe('imports-resolved');
  });

  it('updateModule is a no-op when no project', () => {
    useProjectStore.getState().updateModule(mockModule);
    expect(useProjectStore.getState().project).toBeNull();
  });

  it('updateDependency applies registry metadata while preserving module-specific fields', () => {
    useProjectStore.getState().setProject({
      ...mockProject,
      modules: [
        {
          ...mockModule,
          dependencies: [
            {
              name: 'react',
              ecosystem: 'npm',
              version: '18.0.0',
              constraint: '^18',
              scope: 'runtime',
              source: 'manifest',
              concerns: [],
              usedInFiles: ['src/index.ts'],
              transitiveDeps: null,
              registryMeta: null,
            },
          ],
        },
        {
          ...mockModule,
          path: 'packages/app',
          name: 'app',
          dependencies: [
            {
              name: 'react',
              ecosystem: 'npm',
              version: '19.0.0',
              constraint: '^19',
              scope: 'dev',
              source: 'manifest',
              concerns: ['ui'],
              usedInFiles: [],
              transitiveDeps: null,
              registryMeta: null,
            },
          ],
        },
      ],
    });

    useProjectStore.getState().updateDependency({
      name: 'react',
      ecosystem: 'npm',
      version: '18.0.0',
      constraint: '^18',
      scope: 'runtime',
      source: 'manifest',
      concerns: [],
      usedInFiles: null,
      transitiveDeps: null,
      registryMeta: {
        latestVersion: '19.1.0',
        description: 'React',
        license: 'MIT',
        homepage: null,
        downloads: null,
        deprecated: false,
        publishedAt: null,
      },
    });

    const deps = useProjectStore.getState().project?.modules.map((mod) => mod.dependencies[0]);
    expect(deps?.[0]?.version).toBe('18.0.0');
    expect(deps?.[0]?.usedInFiles).toEqual(['src/index.ts']);
    expect(deps?.[0]?.registryMeta?.latestVersion).toBe('19.1.0');
    expect(deps?.[1]?.version).toBe('19.0.0');
    expect(deps?.[1]?.scope).toBe('dev');
    expect(deps?.[1]?.concerns).toEqual(['ui']);
    expect(deps?.[1]?.registryMeta?.latestVersion).toBe('19.1.0');
  });

  it('clear resets all state', () => {
    useProjectStore.getState().setProject(mockProject);
    useProjectStore.getState().clear();

    const state = useProjectStore.getState();
    expect(state.project).toBeNull();
    expect(state.isScanning).toBe(false);
    expect(state.lastProgress).toBeNull();
  });

  it('clearScanProgress preserves project and clears transient scan state', () => {
    useProjectStore.getState().setProject(mockProject);
    useProjectStore.setState({
      isScanning: true,
      lastProgress: {
        type: 'progress',
        requestId: 'r1',
        message: 'Scanning...',
        phase: 0,
      },
      fileChangeInProgress: true,
    });

    useProjectStore.getState().clearScanProgress();

    const state = useProjectStore.getState();
    expect(state.project).toEqual(mockProject);
    expect(state.isScanning).toBe(false);
    expect(state.lastProgress).toBeNull();
    expect(state.fileChangeInProgress).toBe(false);
  });
});
