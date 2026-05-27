/**
 * Detail view state store.
 * Holds the currently selected dependency for the detail panel.
 */

import { create } from 'zustand';
import type { Ecosystem } from '@deckgraph/shared';

export interface SelectedDep {
  readonly name: string;
  readonly ecosystem: Ecosystem;
}

export interface DetailState {
  readonly selectedDep: SelectedDep | null;
  readonly isEnriching: boolean;
  readonly enrichmentRequestId: string | null;
}

export interface DetailActions {
  selectDep: (dep: SelectedDep) => void;
  closeDep: () => void;
  setEnriching: (isEnriching: boolean) => void;
  startEnriching: (requestId: string) => void;
  completeEnriching: (requestId: string) => void;
}

export type DetailStore = DetailState & DetailActions;

export const useDetailStore = create<DetailStore>((set) => ({
  selectedDep: null,
  isEnriching: false,
  enrichmentRequestId: null,

  selectDep: (dep) =>
    set(() => ({ selectedDep: dep, isEnriching: false, enrichmentRequestId: null })),

  closeDep: () =>
    set(() => ({ selectedDep: null, isEnriching: false, enrichmentRequestId: null })),

  setEnriching: (isEnriching) =>
    set((state) => ({ ...state, isEnriching, enrichmentRequestId: isEnriching ? state.enrichmentRequestId : null })),

  startEnriching: (requestId) =>
    set((state) => ({ ...state, isEnriching: true, enrichmentRequestId: requestId })),

  completeEnriching: (requestId) =>
    set((state) => {
      if (state.enrichmentRequestId !== requestId) return state;
      return { ...state, isEnriching: false, enrichmentRequestId: null };
    }),
}));
