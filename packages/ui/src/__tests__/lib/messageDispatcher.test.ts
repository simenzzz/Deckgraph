/**
 * Tests for message dispatcher.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { ServerMessage, Project, ViewResult, Module } from '@deckgraph/shared';
import { dispatchServerMessage } from '@/lib/messageDispatcher';
import { useConnectionStore } from '@/stores/connectionStore';
import { useDetailStore } from '@/stores/detailStore';
import { useProjectStore } from '@/stores/projectStore';
import { useViewStore } from '@/stores/viewStore';

const mockProject: Project = {
  root: '/test',
  config: null,
  modules: [],
  crossEdges: [],
  lastScannedAt: '2024-01-01T00:00:00.000Z',
};

const mockViewResult: ViewResult = {
  modules: [],
  crossEdges: [],
  summary: {
    totalDeps: 0,
    byEcosystem: { npm: 0, pypi: 0, cargo: 0, go: 0, maven: 0 },
    byScope: { runtime: 0, dev: 0, build: 0, optional: 0, peer: 0 },
    outdatedCount: null,
    unusedCount: null,
    moduleCount: 0,
    crossEdgeCount: 0,
  },
};

describe('dispatchServerMessage', () => {
  beforeEach(() => {
    useConnectionStore.setState({ status: 'connected', lastError: null });
    useProjectStore.setState({ project: null, isScanning: false, lastProgress: null });
    useViewStore.setState({ result: null, isLoading: false, selectedModulePath: null, currentView: 'overview' });
  });

  it('dispatches project_overview to projectStore', () => {
    const msg: ServerMessage = {
      type: 'project_overview',
      requestId: 'r1',
      data: mockProject,
    };

    dispatchServerMessage(msg);
    expect(useProjectStore.getState().project).toEqual(mockProject);
  });

  it('dispatches view_result to viewStore', () => {
    const msg: ServerMessage = {
      type: 'view_result',
      requestId: 'r1',
      data: mockViewResult,
    };

    dispatchServerMessage(msg);
    expect(useViewStore.getState().result).toEqual(mockViewResult);
  });

  it('dispatches progress to projectStore', () => {
    const msg: ServerMessage = {
      type: 'progress',
      requestId: 'r1',
      message: 'Scanning...',
      phase: 0,
    };

    dispatchServerMessage(msg);
    expect(useProjectStore.getState().lastProgress).toEqual(msg);
    expect(useProjectStore.getState().isScanning).toBe(true);
  });

  it('dispatches error to connectionStore and clears loading', () => {
    // H4: Set loading to true first, then verify error clears it
    useViewStore.setState({ isLoading: true });

    const msg: ServerMessage = {
      type: 'error',
      requestId: 'r1',
      message: 'Something failed',
      suggestion: 'Try again',
    };

    dispatchServerMessage(msg);
    expect(useConnectionStore.getState().lastError).toBe('Something failed');
    expect(useViewStore.getState().isLoading).toBe(false);
  });

  it('dispatches module_updated to projectStore', () => {
    useProjectStore.getState().setProject({
      ...mockProject,
      modules: [{
        path: 'pkg/a',
        name: 'a',
        ecosystem: 'npm',
        manifests: ['package.json'],
        dependencies: [],
        analysisState: 'manifest-only',
      }],
    });

    const updatedModule: Module = {
      path: 'pkg/a',
      name: 'a',
      ecosystem: 'npm',
      manifests: ['package.json'],
      dependencies: [],
      analysisState: 'imports-resolved',
    };

    const msg: ServerMessage = {
      type: 'module_updated',
      requestId: 'r1',
      module: updatedModule,
    };

    dispatchServerMessage(msg);
    expect(useProjectStore.getState().project?.modules[0].analysisState).toBe('imports-resolved');
  });

  it('dispatches dependency_enriched to projectStore and detailStore', () => {
    const enrichedDep = {
      name: 'react',
      ecosystem: 'npm' as const,
      version: '19.0.0',
      constraint: '^19.0.0',
      scope: 'runtime' as const,
      source: 'manifest' as const,
      concerns: [],
      usedInFiles: null,
      transitiveDeps: null,
      registryMeta: {
        latestVersion: '19.1.0',
        description: 'React library',
        license: 'MIT',
        homepage: null,
        downloads: null,
        deprecated: false,
        publishedAt: null,
      },
    };

    // Set up project with the dep
    useProjectStore.getState().setProject({
      ...mockProject,
      modules: [{
        path: 'pkg/a',
        name: 'a',
        ecosystem: 'npm',
        manifests: ['package.json'],
        dependencies: [{
          name: 'react',
          ecosystem: 'npm',
          version: '19.0.0',
          constraint: '^19.0.0',
          scope: 'runtime',
          source: 'manifest',
          concerns: [],
          usedInFiles: null,
          transitiveDeps: null,
          registryMeta: null,
        }],
        analysisState: 'manifest-only',
      }],
    });

    useDetailStore.setState({ isEnriching: true });

    const msg: ServerMessage = {
      type: 'dependency_enriched',
      requestId: 'r1',
      dependency: enrichedDep,
    };

    dispatchServerMessage(msg);

    // Check projectStore was updated
    const dep = useProjectStore.getState().project?.modules[0].dependencies[0];
    expect(dep?.registryMeta?.latestVersion).toBe('19.1.0');

    // Check detailStore enriching was cleared
    expect(useDetailStore.getState().isEnriching).toBe(false);
  });
});
