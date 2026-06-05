/**
 * Derived selector for whether any dependency-scoped filter is active.
 */

import { useFilterStore } from '@/stores';

/** True when any dependency-scoped filter (scope/concern/search) is active. */
export function useHasDependencyFilters(): boolean {
  const scopes = useFilterStore((s) => s.scopes);
  const concern = useFilterStore((s) => s.concern);
  const search = useFilterStore((s) => s.search);
  return scopes.length > 0 || concern !== null || search.length > 0;
}
