import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterBar } from '@/components/explorer/FilterBar';
import { useFilterStore } from '@/stores/filterStore';

describe('FilterBar', () => {
  beforeEach(() => {
    useFilterStore.getState().resetFilters();
  });

  it('renders ecosystem toggle buttons', () => {
    render(<FilterBar />);
    expect(screen.getByText('npm')).toBeInTheDocument();
    expect(screen.getByText('PyPI')).toBeInTheDocument();
    expect(screen.getByText('Go')).toBeInTheDocument();
  });

  it('renders module search input', () => {
    render(<FilterBar />);
    expect(screen.getByPlaceholderText('Search modules...')).toBeInTheDocument();
  });

  it('does not render module-scoped filters (scope, search dependencies)', () => {
    render(<FilterBar />);
    expect(screen.queryByText('dev')).toBeNull();
    expect(screen.queryByPlaceholderText('Search dependencies...')).toBeNull();
  });

  it('toggles ecosystem on click', () => {
    render(<FilterBar />);
    fireEvent.click(screen.getByText('npm'));
    expect(useFilterStore.getState().ecosystems).toContain('npm');

    fireEvent.click(screen.getByText('npm'));
    expect(useFilterStore.getState().ecosystems).not.toContain('npm');
  });

  it('updates module search on input', () => {
    render(<FilterBar />);
    const input = screen.getByPlaceholderText('Search modules...');
    fireEvent.change(input, { target: { value: 'api' } });
    expect(useFilterStore.getState().moduleSearch).toBe('api');
  });

  it('shows clear button when filters are active', () => {
    useFilterStore.getState().toggleEcosystem('npm');
    render(<FilterBar />);
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('shows clear button when module search is active', () => {
    useFilterStore.getState().setModuleSearch('api');
    render(<FilterBar />);
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('resets filters on clear click', () => {
    useFilterStore.getState().toggleEcosystem('npm');
    useFilterStore.getState().setModuleSearch('api');
    render(<FilterBar />);

    fireEvent.click(screen.getByText('Clear'));
    const state = useFilterStore.getState();
    expect(state.ecosystems).toEqual([]);
    expect(state.moduleSearch).toBe('');
  });
});
