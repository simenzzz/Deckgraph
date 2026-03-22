/**
 * Project state store.
 * Holds the current project data pushed by the backend.
 */

import { create } from 'zustand';
import type { Dependency, Module, Project, ProgressMessage } from '@deckgraph/shared';

export interface ProjectState {
  readonly project: Project | null;
  readonly isScanning: boolean;
  readonly lastProgress: ProgressMessage | null;
}

export interface ProjectActions {
  setProject: (project: Project) => void;
  setScanning: (isScanning: boolean) => void;
  setProgress: (progress: ProgressMessage) => void;
  updateModule: (updated: Module) => void;
  updateDependency: (updated: Dependency) => void;
  clear: () => void;
}

export type ProjectStore = ProjectState & ProjectActions;

export const useProjectStore = create<ProjectStore>((set) => ({
  project: null,
  isScanning: false,
  lastProgress: null,

  setProject: (project) =>
    set(() => ({ project, isScanning: false, lastProgress: null })),

  setScanning: (isScanning) =>
    set((state) => ({ ...state, isScanning })),

  setProgress: (progress) =>
    set((state) => ({ ...state, lastProgress: progress, isScanning: true })),

  updateModule: (updated) =>
    set((state) => {
      if (!state.project) return state;
      return {
        ...state,
        project: {
          ...state.project,
          modules: state.project.modules.map((m) =>
            m.path === updated.path ? updated : m,
          ),
        },
      };
    }),

  updateDependency: (updated) =>
    set((state) => {
      if (!state.project) return state;
      return {
        ...state,
        project: {
          ...state.project,
          modules: state.project.modules.map((m) => {
            const hasMatch = m.dependencies.some(
              (d) => d.name === updated.name && d.ecosystem === updated.ecosystem,
            );
            if (!hasMatch) return m;
            return {
              ...m,
              dependencies: m.dependencies.map((d) =>
                d.name === updated.name && d.ecosystem === updated.ecosystem ? updated : d,
              ),
            };
          }),
        },
      };
    }),

  clear: () =>
    set(() => ({ project: null, isScanning: false, lastProgress: null })),
}));
