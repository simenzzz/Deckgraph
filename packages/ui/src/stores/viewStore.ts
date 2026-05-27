/**
 * View state store.
 * Holds the current ViewResult and navigation state.
 */

import { create } from 'zustand';
import type { ViewResult } from '@deckgraph/shared';

export type CurrentView = 'overview' | 'explorer' | 'health' | 'graph';

export interface ViewState {
  readonly result: ViewResult | null;
  readonly isLoading: boolean;
  readonly selectedModulePath: string | null;
  readonly currentView: CurrentView;
  readonly analyzingModulePath: string | null;
  readonly analysisRequestId: string | null;
}

export interface ViewActions {
  setResult: (result: ViewResult) => void;
  setLoading: (isLoading: boolean) => void;
  selectModule: (path: string | null) => void;
  setView: (view: CurrentView) => void;
  startModuleAnalysis: (modulePath: string, requestId: string) => void;
  completeModuleAnalysis: (requestId: string) => void;
  clear: () => void;
}

export type ViewStore = ViewState & ViewActions;

export const useViewStore = create<ViewStore>((set) => ({
  result: null,
  isLoading: false,
  selectedModulePath: null,
  currentView: 'overview',
  analyzingModulePath: null,
  analysisRequestId: null,

  // M5: Reset selectedModulePath if the selected module is no longer in the result
  setResult: (result) =>
    set((state) => {
      const modulePaths = new Set(result.modules.map((m) => m.path));
      const selectedModulePath =
        state.selectedModulePath !== null && modulePaths.has(state.selectedModulePath)
          ? state.selectedModulePath
          : null;
      return { result, isLoading: false, selectedModulePath };
    }),

  setLoading: (isLoading) =>
    set((state) => ({ ...state, isLoading })),

  selectModule: (path) =>
    set((state) => ({ ...state, selectedModulePath: path })),

  setView: (view) =>
    set((state) => ({ ...state, currentView: view })),

  startModuleAnalysis: (modulePath, requestId) =>
    set((state) => ({ ...state, analyzingModulePath: modulePath, analysisRequestId: requestId })),

  completeModuleAnalysis: (requestId) =>
    set((state) => {
      if (state.analysisRequestId !== requestId) return state;
      return { ...state, analyzingModulePath: null, analysisRequestId: null };
    }),

  clear: () =>
    set(() => ({
      result: null,
      isLoading: false,
      selectedModulePath: null,
      currentView: 'overview',
      analyzingModulePath: null,
      analysisRequestId: null,
    })),
}));
