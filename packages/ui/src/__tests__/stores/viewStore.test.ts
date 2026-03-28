import { describe, it, expect, beforeEach } from 'vitest';
import { useViewStore } from '@/stores/viewStore';
import type { ViewResult } from '@deckgraph/shared';

const mockResult: ViewResult = {
  modules: [
    {
      path: 'packages/lib',
      name: 'lib',
      ecosystem: 'npm',
      analysisState: 'manifest-only',
      dependencies: [],
      totalDependencyCount: 5,
    },
  ],
  crossEdges: [],
  summary: {
    totalDeps: 5,
    byEcosystem: { npm: 5, pypi: 0, cargo: 0, go: 0, maven: 0 },
    byScope: { runtime: 3, dev: 2, build: 0, optional: 0, peer: 0 },
    outdatedCount: null,
    unusedCount: null,
    moduleCount: 1,
    crossEdgeCount: 0,
  },
};

describe('viewStore', () => {
  beforeEach(() => {
    useViewStore.setState({
      result: null,
      isLoading: false,
      selectedModulePath: null,
      currentView: 'overview',
    });
  });

  it('starts with null result and overview view', () => {
    const state = useViewStore.getState();
    expect(state.result).toBeNull();
    expect(state.currentView).toBe('overview');
  });

  it('setResult stores result and clears loading', () => {
    useViewStore.getState().setLoading(true);
    useViewStore.getState().setResult(mockResult);

    const state = useViewStore.getState();
    expect(state.result).toEqual(mockResult);
    expect(state.isLoading).toBe(false);
  });

  it('setLoading updates isLoading', () => {
    useViewStore.getState().setLoading(true);
    expect(useViewStore.getState().isLoading).toBe(true);
  });

  it('selectModule updates selectedModulePath', () => {
    useViewStore.getState().selectModule('packages/lib');
    expect(useViewStore.getState().selectedModulePath).toBe('packages/lib');
  });

  it('selectModule accepts null', () => {
    useViewStore.getState().selectModule('packages/lib');
    useViewStore.getState().selectModule(null);
    expect(useViewStore.getState().selectedModulePath).toBeNull();
  });

  it('setView updates currentView', () => {
    useViewStore.getState().setView('explorer');
    expect(useViewStore.getState().currentView).toBe('explorer');
  });

  it('setView accepts health view', () => {
    useViewStore.getState().setView('health');
    expect(useViewStore.getState().currentView).toBe('health');
  });

  it('setView accepts graph view', () => {
    useViewStore.getState().setView('graph');
    expect(useViewStore.getState().currentView).toBe('graph');
  });
});
