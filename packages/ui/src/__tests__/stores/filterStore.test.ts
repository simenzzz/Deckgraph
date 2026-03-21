import { describe, it, expect, beforeEach } from 'vitest';
import { useFilterStore } from '@/stores/filterStore';

describe('filterStore', () => {
  beforeEach(() => {
    useFilterStore.getState().resetFilters();
  });

  it('starts with empty filters', () => {
    const state = useFilterStore.getState();
    expect(state.ecosystems).toEqual([]);
    expect(state.scopes).toEqual([]);
    expect(state.search).toBe('');
    expect(state.showCrossEdges).toBe(false);
  });

  it('toggleEcosystem adds ecosystem', () => {
    useFilterStore.getState().toggleEcosystem('npm');
    expect(useFilterStore.getState().ecosystems).toEqual(['npm']);
  });

  it('toggleEcosystem removes existing ecosystem', () => {
    useFilterStore.getState().toggleEcosystem('npm');
    useFilterStore.getState().toggleEcosystem('npm');
    expect(useFilterStore.getState().ecosystems).toEqual([]);
  });

  it('toggleEcosystem supports multiple', () => {
    useFilterStore.getState().toggleEcosystem('npm');
    useFilterStore.getState().toggleEcosystem('pypi');
    expect(useFilterStore.getState().ecosystems).toEqual(['npm', 'pypi']);
  });

  it('toggleScope adds and removes', () => {
    useFilterStore.getState().toggleScope('dev');
    expect(useFilterStore.getState().scopes).toEqual(['dev']);

    useFilterStore.getState().toggleScope('dev');
    expect(useFilterStore.getState().scopes).toEqual([]);
  });

  it('setSearch updates search string', () => {
    useFilterStore.getState().setSearch('react');
    expect(useFilterStore.getState().search).toBe('react');
  });

  it('setShowCrossEdges updates flag', () => {
    useFilterStore.getState().setShowCrossEdges(true);
    expect(useFilterStore.getState().showCrossEdges).toBe(true);
  });

  it('resetFilters clears all state', () => {
    useFilterStore.getState().toggleEcosystem('npm');
    useFilterStore.getState().toggleScope('dev');
    useFilterStore.getState().setSearch('react');
    useFilterStore.getState().setShowCrossEdges(true);
    useFilterStore.getState().resetFilters();

    const state = useFilterStore.getState();
    expect(state.ecosystems).toEqual([]);
    expect(state.scopes).toEqual([]);
    expect(state.search).toBe('');
    expect(state.showCrossEdges).toBe(false);
  });
});
