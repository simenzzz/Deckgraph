/**
 * Tests for message dispatcher.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { ServerMessage, Project, ViewResult, Module, PackageActionResult } from '@deckgraph/shared';
import { dispatchServerMessage } from '@/lib/messageDispatcher';
import { useActionStore } from '@/stores/actionStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useDetailStore } from '@/stores/detailStore';
import { useProjectStore } from '@/stores/projectStore';
import { useViewStore } from '@/stores/viewStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

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
    useConnectionStore.setState({
      status: 'connected',
      lastError: null,
      lastErrorSuggestion: null,
      configPresent: null,
      hasScannedData: null,
      demoMode: false,
      demoRepositories: [],
    });
    useProjectStore.setState({ project: null, isScanning: false, lastProgress: null, fileChangeInProgress: false });
    useViewStore.setState({
      result: null,
      isLoading: false,
      selectedModulePath: null,
      currentView: 'overview',
      analyzingModulePath: null,
      analysisRequestId: null,
    });
    useWorkspaceStore.setState({ workspace: null, activeProjectRoot: null });
    useDetailStore.setState({ selectedDep: null, isEnriching: false, enrichmentRequestId: null });
    useActionStore.setState({
      inProgress: new Map(),
      lastResult: null,
      batchResults: [],
      isBatchRunning: false,
    });
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

  it('dispatches demo_repository_imported to connectionStore and projectStore', () => {
    const customRepository = {
      id: 'custom-example-demo-repo',
      label: 'example/demo-repo',
      url: 'https://github.com/example/demo-repo.git',
      description: 'README snippet from the imported repository.',
    };

    dispatchServerMessage({
      type: 'demo_repository_imported',
      requestId: 'custom-1',
      repository: customRepository,
      data: mockProject,
    });

    expect(useConnectionStore.getState().demoRepositories).toEqual([customRepository]);
    expect(useProjectStore.getState().project).toEqual(mockProject);
    expect(useProjectStore.getState().isScanning).toBe(false);
  });

  it('dedupes demo_repository_imported repository cards by id', () => {
    const customRepository = {
      id: 'custom-example-demo-repo',
      label: 'example/demo-repo',
      url: 'https://github.com/example/demo-repo.git',
      description: 'Updated README snippet.',
    };
    useConnectionStore.setState({
      demoRepositories: [{ ...customRepository, description: 'Old snippet.' }],
    });

    dispatchServerMessage({
      type: 'demo_repository_imported',
      requestId: 'custom-1',
      repository: customRepository,
      data: mockProject,
    });

    expect(useConnectionStore.getState().demoRepositories).toEqual([customRepository]);
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

  it('clears scan progress when error matches active progress request', () => {
    useProjectStore.getState().setProgress({
      type: 'progress',
      requestId: 'scan-1',
      message: 'Importing demo repository...',
      phase: 0,
    });

    dispatchServerMessage({
      type: 'error',
      requestId: 'scan-1',
      message: 'Demo repository unavailable',
      suggestion: 'Choose one of the listed demo repositories and try again',
    });

    expect(useProjectStore.getState().isScanning).toBe(false);
    expect(useProjectStore.getState().lastProgress).toBeNull();
  });

  it('does not clear scan progress for unrelated errors', () => {
    useProjectStore.getState().setProgress({
      type: 'progress',
      requestId: 'scan-1',
      message: 'Importing demo repository...',
      phase: 0,
    });

    dispatchServerMessage({
      type: 'error',
      requestId: 'other-1',
      message: 'Package not found',
      suggestion: 'Check the package name',
    });

    expect(useProjectStore.getState().isScanning).toBe(true);
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

    useDetailStore.getState().startEnriching('r1');

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

  it('clears matching enrichment on error without clearing unrelated enrichment', () => {
    useDetailStore.getState().startEnriching('enrich-1');

    dispatchServerMessage({
      type: 'error',
      requestId: 'other-1',
      message: 'No scan data available',
      suggestion: 'Run a scan_project request first',
    });
    expect(useDetailStore.getState().isEnriching).toBe(true);

    dispatchServerMessage({
      type: 'error',
      requestId: 'enrich-1',
      message: 'Package not found',
      suggestion: 'Check the package name',
    });
    expect(useDetailStore.getState().isEnriching).toBe(false);
  });

  it('dispatches file_change_detected to projectStore', () => {
    const msg: ServerMessage = {
      type: 'file_change_detected',
      requestId: 'r1',
      affectedModules: ['pkg/a'],
      timestamp: '2024-01-01T00:00:00.000Z',
    };

    dispatchServerMessage(msg);
    expect(useProjectStore.getState().fileChangeInProgress).toBe(true);
  });

  it('project_overview clears fileChangeInProgress', () => {
    useProjectStore.setState({ fileChangeInProgress: true });

    const msg: ServerMessage = {
      type: 'project_overview',
      requestId: 'r1',
      data: mockProject,
    };

    dispatchServerMessage(msg);
    expect(useProjectStore.getState().fileChangeInProgress).toBe(false);
  });

  it('dispatches package_action_result to actionStore', () => {
    useActionStore.getState().startAction('packages/app', 'req-1');

    const result: PackageActionResult = {
      action: 'update',
      ecosystem: 'npm',
      packageName: 'react',
      modulePath: 'packages/app',
      status: 'success',
      previousVersion: '18.0.0',
      newVersion: '19.0.0',
      error: null,
      command: 'pnpm add react@19.0.0',
    };

    const msg: ServerMessage = {
      type: 'package_action_result',
      requestId: 'req-1',
      result,
    };

    dispatchServerMessage(msg);
    expect(useActionStore.getState().lastResult).toEqual(result);
    expect(useActionStore.getState().inProgress.has('packages/app')).toBe(false);
  });

  it('dispatches package_batch_result to actionStore', () => {
    useActionStore.getState().startBatch();

    const results: PackageActionResult[] = [
      {
        action: 'update',
        ecosystem: 'npm',
        packageName: 'react',
        modulePath: 'packages/app',
        status: 'success',
        previousVersion: '18.0.0',
        newVersion: '19.0.0',
        error: null,
        command: 'pnpm add react@19.0.0',
      },
    ];

    const msg: ServerMessage = {
      type: 'package_batch_result',
      requestId: 'req-1',
      results,
      completedCount: 1,
      totalCount: 1,
      stoppedEarly: false,
    };

    dispatchServerMessage(msg);
    expect(useActionStore.getState().isBatchRunning).toBe(false);
    expect(useActionStore.getState().batchResults).toHaveLength(1);
  });

  it('ready without scan data clears stale session state', () => {
    useProjectStore.getState().setProject(mockProject);
    useViewStore.setState({
      result: mockViewResult,
      isLoading: true,
      selectedModulePath: 'pkg/a',
      currentView: 'explorer',
    });
    useWorkspaceStore.setState({
      workspace: {
        root: '/workspace',
        config: null,
        projects: [mockProject],
        crossRootDeps: [],
        lastScannedAt: '2024-01-01T00:00:00.000Z',
      },
      activeProjectRoot: '/test',
    });
    useDetailStore.setState({
      selectedDep: { name: 'react', ecosystem: 'npm' },
      isEnriching: true,
      enrichmentRequestId: 'req-enrich',
    });
    useActionStore.getState().startAction('pkg/a', 'req-1');

    dispatchServerMessage({
      type: 'ready',
      requestId: 'ready-1',
      configPresent: true,
      hasScannedData: false,
      demoMode: true,
      demoRepositories: [],
    });

    expect(useConnectionStore.getState().demoMode).toBe(true);
    expect(useProjectStore.getState().project).toBeNull();
    expect(useWorkspaceStore.getState().workspace).toBeNull();
    expect(useViewStore.getState().result).toBeNull();
    expect(useViewStore.getState().currentView).toBe('overview');
    expect(useDetailStore.getState().selectedDep).toBeNull();
    expect(useActionStore.getState().inProgress.size).toBe(0);
  });
});
