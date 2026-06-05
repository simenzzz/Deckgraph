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

export interface EnrichError {
  readonly message: string;
  readonly suggestion: string;
}

export interface DetailState {
  readonly selectedDep: SelectedDep | null;
  readonly isEnriching: boolean;
  readonly enrichmentRequestId: string | null;
  /** Last enrichment failure, surfaced in the detail panel (not as a global toast). */
  readonly enrichError: EnrichError | null;
}

export interface DetailActions {
  selectDep: (dep: SelectedDep) => void;
  closeDep: () => void;
  setEnriching: (isEnriching: boolean) => void;
  startEnriching: (requestId: string) => void;
  completeEnriching: (requestId: string) => void;
  setEnrichError: (error: EnrichError) => void;
}

export type DetailStore = DetailState & DetailActions;

export const useDetailStore = create<DetailStore>((set) => ({
  selectedDep: null,
  isEnriching: false,
  enrichmentRequestId: null,
  enrichError: null,

  selectDep: (dep) =>
    set(() => ({ selectedDep: dep, isEnriching: false, enrichmentRequestId: null, enrichError: null })),

  closeDep: () =>
    set(() => ({ selectedDep: null, isEnriching: false, enrichmentRequestId: null, enrichError: null })),

  setEnriching: (isEnriching) =>
    set((state) => ({ ...state, isEnriching, enrichmentRequestId: isEnriching ? state.enrichmentRequestId : null })),

  // Clear any prior error when a fresh request starts.
  startEnriching: (requestId) =>
    set((state) => ({ ...state, isEnriching: true, enrichmentRequestId: requestId, enrichError: null })),

  completeEnriching: (requestId) =>
    set((state) => {
      if (state.enrichmentRequestId !== requestId) return state;
      // A request resolved — clear any prior error so the store reflects the
      // outcome rather than relying on render-order to mask a stale error.
      return { ...state, isEnriching: false, enrichmentRequestId: null, enrichError: null };
    }),

  // An enrichment request resolved with an error — surface it in the panel
  // and stop the loading state.
  setEnrichError: (error) =>
    set((state) => ({ ...state, isEnriching: false, enrichmentRequestId: null, enrichError: error })),
}));
