/**
 * Workspace state management.
 *
 * Manages the aggregated workspace data from multiple project roots.
 */

import { create } from 'zustand';
import type { Workspace } from '@deckgraph/shared';
import { useProjectStore } from './projectStore';

interface WorkspaceState {
  workspace: Workspace | null;
  activeProjectRoot: string | null; // null = show all projects
  setWorkspace: (workspace: Workspace) => void;
  setActiveProject: (root: string | null) => void;
  clear: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspace: null,
  activeProjectRoot: null,

  setWorkspace: (workspace) => {
    const currentRoot = useWorkspaceStore.getState().activeProjectRoot;
    const activeProject = currentRoot
      ? workspace.projects.find((p) => p.root === currentRoot) ?? null
      : null;

    set({
      workspace,
      activeProjectRoot: activeProject?.root ?? null,
    });

    if (activeProject) {
      useProjectStore.getState().setProject(activeProject);
    } else {
      useProjectStore.getState().clear();
    }
  },

  setActiveProject: (root) => {
    const { workspace } = useWorkspaceStore.getState();
    if (!workspace) return;

    if (root === null) {
      set({ activeProjectRoot: null });
      useProjectStore.getState().clear();
      return;
    }

    const project = workspace.projects.find((p) => p.root === root);
    if (project) {
      set({ activeProjectRoot: root });
      useProjectStore.getState().setProject(project);
    }
  },

  clear: () => set({ workspace: null, activeProjectRoot: null }),
}));
