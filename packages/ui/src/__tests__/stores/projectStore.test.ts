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
