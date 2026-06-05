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
    expect(state.moduleSearch).toBe('');
    expect(state.concern).toBeNull();
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

  it('setModuleSearch updates module search string', () => {
    useFilterStore.getState().setModuleSearch('api');
    expect(useFilterStore.getState().moduleSearch).toBe('api');
  });

  it('clearModuleFilters clears only module-level filters', () => {
    useFilterStore.getState().toggleEcosystem('npm');
    useFilterStore.getState().setModuleSearch('api');
    useFilterStore.getState().toggleScope('dev');
    useFilterStore.getState().setSearch('react');
    useFilterStore.getState().setConcern('auth');
    useFilterStore.getState().clearModuleFilters();

    const state = useFilterStore.getState();
    expect(state.ecosystems).toEqual([]);
    expect(state.moduleSearch).toBe('');
    // Dependency-level filters untouched
    expect(state.scopes).toEqual(['dev']);
    expect(state.search).toBe('react');
    expect(state.concern).toBe('auth');
  });

  it('clearDependencyFilters clears only dependency-level filters', () => {
    useFilterStore.getState().toggleEcosystem('npm');
    useFilterStore.getState().setModuleSearch('api');
    useFilterStore.getState().toggleScope('dev');
    useFilterStore.getState().setSearch('react');
    useFilterStore.getState().setConcern('auth');
    useFilterStore.getState().clearDependencyFilters();

    const state = useFilterStore.getState();
    expect(state.scopes).toEqual([]);
    expect(state.search).toBe('');
    expect(state.concern).toBeNull();
    // Module-level filters untouched
    expect(state.ecosystems).toEqual(['npm']);
    expect(state.moduleSearch).toBe('api');
  });

  it('resetFilters clears all state', () => {
    useFilterStore.getState().toggleEcosystem('npm');
    useFilterStore.getState().toggleScope('dev');
    useFilterStore.getState().setSearch('react');
    useFilterStore.getState().setModuleSearch('api');
    useFilterStore.getState().setConcern('auth');
    useFilterStore.getState().resetFilters();

    const state = useFilterStore.getState();
    expect(state.ecosystems).toEqual([]);
    expect(state.scopes).toEqual([]);
    expect(state.search).toBe('');
    expect(state.moduleSearch).toBe('');
    expect(state.concern).toBeNull();
  });
});
