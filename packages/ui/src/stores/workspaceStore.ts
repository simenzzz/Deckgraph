/**
 * Workspace state management.
 *
 * Manages the aggregated workspace data from multiple project roots.
 */

import { create } from 'zustand';
import type { Workspace } from '@deckgraph/shared';

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

  setWorkspace: (workspace) => set({ workspace }),

  setActiveProject: (root) => set({ activeProjectRoot: root }),

  clear: () => set({ workspace: null, activeProjectRoot: null }),
}));
