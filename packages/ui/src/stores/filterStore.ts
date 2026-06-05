/**
 * Filter state store.
 * Local-only (not backend-pushed) for instant filter toggling.
 */

import { create } from 'zustand';
import type { DependencyScope, Ecosystem } from '@deckgraph/shared';

export interface FilterState {
  readonly ecosystems: readonly Ecosystem[];
  readonly scopes: readonly DependencyScope[];
  readonly search: string;
  readonly moduleSearch: string;
  readonly concern: string | null;
}

export interface FilterActions {
  toggleEcosystem: (ecosystem: Ecosystem) => void;
  toggleScope: (scope: DependencyScope) => void;
  setSearch: (search: string) => void;
  setModuleSearch: (moduleSearch: string) => void;
  setConcern: (concern: string | null) => void;
  resetFilters: () => void;
}

export type FilterStore = FilterState & FilterActions;

const INITIAL_STATE: FilterState = {
  ecosystems: [],
  scopes: [],
  search: '',
  moduleSearch: '',
  concern: null,
};

export const useFilterStore = create<FilterStore>((set) => ({
  ...INITIAL_STATE,

  toggleEcosystem: (ecosystem) =>
    set((state) => {
      const exists = state.ecosystems.includes(ecosystem);
      return {
        ...state,
        ecosystems: exists
          ? state.ecosystems.filter((e) => e !== ecosystem)
          : [...state.ecosystems, ecosystem],
      };
    }),

  toggleScope: (scope) =>
    set((state) => {
      const exists = state.scopes.includes(scope);
      return {
        ...state,
        scopes: exists
          ? state.scopes.filter((s) => s !== scope)
          : [...state.scopes, scope],
      };
    }),

  setSearch: (search) =>
    set((state) => ({ ...state, search })),

  setModuleSearch: (moduleSearch) =>
    set((state) => ({ ...state, moduleSearch })),

  setConcern: (concern) =>
    set((state) => ({ ...state, concern })),

  resetFilters: () =>
    set((state) => ({ ...state, ...INITIAL_STATE })),
}));
