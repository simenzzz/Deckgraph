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
}

export interface DetailActions {
  selectDep: (dep: SelectedDep) => void;
  closeDep: () => void;
  setEnriching: (isEnriching: boolean) => void;
}

export type DetailStore = DetailState & DetailActions;

export const useDetailStore = create<DetailStore>((set) => ({
  selectedDep: null,
  isEnriching: false,

  selectDep: (dep) =>
    set(() => ({ selectedDep: dep, isEnriching: false })),

  closeDep: () =>
    set(() => ({ selectedDep: null, isEnriching: false })),

  setEnriching: (isEnriching) =>
    set((state) => ({ ...state, isEnriching })),
}));
