import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHasDependencyFilters } from '@/hooks/useHasDependencyFilters';
import { useFilterStore } from '@/stores/filterStore';

describe('useHasDependencyFilters', () => {
  beforeEach(() => {
    useFilterStore.getState().resetFilters();
  });

  it('is false when no dependency filters are active', () => {
    const { result } = renderHook(() => useHasDependencyFilters());
    expect(result.current).toBe(false);
  });

  it('is true when a scope is active', () => {
    useFilterStore.setState({ scopes: ['dev'] });
    const { result } = renderHook(() => useHasDependencyFilters());
    expect(result.current).toBe(true);
  });

  it('is true when a concern is active', () => {
    useFilterStore.setState({ concern: 'auth' });
    const { result } = renderHook(() => useHasDependencyFilters());
    expect(result.current).toBe(true);
  });

  it('is true when a dependency search is active', () => {
    useFilterStore.setState({ search: 'react' });
    const { result } = renderHook(() => useHasDependencyFilters());
    expect(result.current).toBe(true);
  });

  it('ignores module-level filters (ecosystems / module search)', () => {
    useFilterStore.setState({ ecosystems: ['npm'], moduleSearch: 'api' });
    const { result } = renderHook(() => useHasDependencyFilters());
    expect(result.current).toBe(false);
  });
});
