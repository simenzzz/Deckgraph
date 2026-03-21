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

  it('renders scope toggle buttons', () => {
    render(<FilterBar />);
    expect(screen.getByText('runtime')).toBeInTheDocument();
    expect(screen.getByText('dev')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<FilterBar />);
    expect(screen.getByPlaceholderText('Search dependencies...')).toBeInTheDocument();
  });

  it('toggles ecosystem on click', () => {
    render(<FilterBar />);
    fireEvent.click(screen.getByText('npm'));
    expect(useFilterStore.getState().ecosystems).toContain('npm');

    fireEvent.click(screen.getByText('npm'));
    expect(useFilterStore.getState().ecosystems).not.toContain('npm');
  });

  it('toggles scope on click', () => {
    render(<FilterBar />);
    fireEvent.click(screen.getByText('dev'));
    expect(useFilterStore.getState().scopes).toContain('dev');
  });

  it('updates search on input', () => {
    render(<FilterBar />);
    const input = screen.getByPlaceholderText('Search dependencies...');
    fireEvent.change(input, { target: { value: 'react' } });
    expect(useFilterStore.getState().search).toBe('react');
  });

  it('shows clear button when filters are active', () => {
    useFilterStore.getState().toggleEcosystem('npm');
    render(<FilterBar />);
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('resets filters on clear click', () => {
    useFilterStore.getState().toggleEcosystem('npm');
    useFilterStore.getState().setSearch('react');
    render(<FilterBar />);

    fireEvent.click(screen.getByText('Clear'));
    const state = useFilterStore.getState();
    expect(state.ecosystems).toEqual([]);
    expect(state.search).toBe('');
  });
});
