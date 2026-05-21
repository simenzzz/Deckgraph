import { beforeEach, describe, expect, it } from 'vitest';
import type { Project, Workspace } from '@deckgraph/shared';
import { useProjectStore } from '@/stores/projectStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const firstProject: Project = {
  root: '/workspace/app',
  config: null,
  modules: [],
  crossEdges: [],
  lastScannedAt: '2024-01-01T00:00:00.000Z',
};

const secondProject: Project = {
  ...firstProject,
  root: '/workspace/api',
};

const workspace: Workspace = {
  config: null,
  projects: [firstProject, secondProject],
  crossRootDeps: [],
  lastScannedAt: '2024-01-01T00:00:00.000Z',
};

describe('workspaceStore', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({ workspace: null, activeProjectRoot: null });
    useProjectStore.setState({
      project: null,
      isScanning: false,
      lastProgress: null,
      fileChangeInProgress: false,
    });
  });

  it('keeps all-projects mode when workspace data is set without an active root', () => {
    useWorkspaceStore.getState().setWorkspace(workspace);

    expect(useWorkspaceStore.getState().activeProjectRoot).toBeNull();
    expect(useProjectStore.getState().project).toBeNull();
  });

  it('copies a project into projectStore only when a concrete root is selected', () => {
    useWorkspaceStore.getState().setWorkspace(workspace);
    useWorkspaceStore.getState().setActiveProject(secondProject.root);

    expect(useWorkspaceStore.getState().activeProjectRoot).toBe(secondProject.root);
    expect(useProjectStore.getState().project).toEqual(secondProject);
  });

  it('returns to all-projects mode and clears the selected project', () => {
    useWorkspaceStore.getState().setWorkspace(workspace);
    useWorkspaceStore.getState().setActiveProject(firstProject.root);
    useWorkspaceStore.getState().setActiveProject(null);

    expect(useWorkspaceStore.getState().activeProjectRoot).toBeNull();
    expect(useProjectStore.getState().project).toBeNull();
  });
});
