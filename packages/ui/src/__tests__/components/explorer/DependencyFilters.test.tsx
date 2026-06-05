import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DependencyFilters } from '@/components/explorer/DependencyFilters';
import { useFilterStore } from '@/stores/filterStore';
import { useViewStore } from '@/stores/viewStore';
import type { Dependency, ViewResult } from '@deckgraph/shared';

function makeViewResultWithConcerns(concerns: readonly string[]): ViewResult {
  const dependencies: Dependency[] = concerns.map((concern) => ({
    name: `package-${concern}`,
    ecosystem: 'npm',
    version: '1.0.0',
    constraint: '^1.0.0',
    scope: 'runtime',
    source: 'manifest',
    concerns: [concern],
    usedInFiles: null,
    transitiveDeps: null,
    registryMeta: null,
  }));

  return {
    modules: [{
      path: 'packages/app',
      name: 'app',
      ecosystem: 'npm',
      analysisState: 'manifest-only',
      dependencies,
      totalDependencyCount: dependencies.length,
    }],
    crossEdges: [],
    summary: {
      totalDeps: dependencies.length,
      byEcosystem: { npm: dependencies.length, pypi: 0, cargo: 0, go: 0, maven: 0 },
      byScope: { runtime: dependencies.length, dev: 0, build: 0, optional: 0, peer: 0 },
      outdatedCount: null,
      unusedCount: null,
      moduleCount: 1,
      crossEdgeCount: 0,
    },
  };
}

describe('DependencyFilters', () => {
  beforeEach(() => {
    useFilterStore.getState().resetFilters();
    useViewStore.setState({ result: null });
  });

  it('renders scope toggle buttons', () => {
    render(<DependencyFilters />);
    expect(screen.getByText('runtime')).toBeInTheDocument();
    expect(screen.getByText('dev')).toBeInTheDocument();
  });

  it('renders the dependency search input', () => {
    render(<DependencyFilters />);
    expect(screen.getByPlaceholderText('Search dependencies...')).toBeInTheDocument();
  });

  it('toggles scope on click', () => {
    render(<DependencyFilters />);
    fireEvent.click(screen.getByText('dev'));
    expect(useFilterStore.getState().scopes).toContain('dev');
  });

  it('updates dependency search on input', () => {
    render(<DependencyFilters />);
    const input = screen.getByPlaceholderText('Search dependencies...');
    fireEvent.change(input, { target: { value: 'react' } });
    expect(useFilterStore.getState().search).toBe('react');
  });

  it('shows no Clear button when no dependency filters are active', () => {
    render(<DependencyFilters />);
    expect(screen.queryByText('Clear')).toBeNull();
  });

  it('shows a Clear button once a scope filter is active', () => {
    useFilterStore.setState({ scopes: ['dev'] });
    render(<DependencyFilters />);
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('shows a Clear button when only a concern filter is active', () => {
    useFilterStore.setState({ concern: 'auth' });
    render(<DependencyFilters />);
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('shows a Clear button when only a dependency search is active', () => {
    useFilterStore.setState({ search: 'react' });
    render(<DependencyFilters />);
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('clears only dependency filters on Clear click, leaving module filters', () => {
    useFilterStore.setState({
      scopes: ['dev'],
      search: 'react',
      concern: 'auth',
      ecosystems: ['npm'],
      moduleSearch: 'api',
    });
    render(<DependencyFilters />);

    fireEvent.click(screen.getByText('Clear'));
    const state = useFilterStore.getState();
    expect(state.scopes).toEqual([]);
    expect(state.search).toBe('');
    expect(state.concern).toBeNull();
    // Module-level filters untouched
    expect(state.ecosystems).toEqual(['npm']);
    expect(state.moduleSearch).toBe('api');
  });

  it('selects and deselects a concern chip', () => {
    useViewStore.setState({ result: makeViewResultWithConcerns(['auth', 'cache']) });
    render(<DependencyFilters />);

    fireEvent.click(screen.getByRole('button', { name: 'auth' }));
    expect(useFilterStore.getState().concern).toBe('auth');

    fireEvent.click(screen.getByRole('button', { name: 'auth' }));
    expect(useFilterStore.getState().concern).toBeNull();
  });

  it('paginates concern tags when more than one page is available', () => {
    useViewStore.setState({
      result: makeViewResultWithConcerns([
        'tag-01',
        'tag-02',
        'tag-03',
        'tag-04',
        'tag-05',
        'tag-06',
        'tag-07',
        'tag-08',
        'tag-09',
        'tag-10',
      ]),
    });

    render(<DependencyFilters />);

    expect(screen.getByRole('button', { name: 'tag-01' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'tag-08' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'tag-09' })).toBeNull();
    expect(screen.getByText('1/2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next concern tags/i }));

    expect(screen.queryByRole('button', { name: 'tag-01' })).toBeNull();
    expect(screen.getByRole('button', { name: 'tag-09' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'tag-10' })).toBeInTheDocument();
    expect(screen.getByText('2/2')).toBeInTheDocument();
  });

  it('omits concern pagination controls when tags fit on one page', () => {
    useViewStore.setState({
      result: makeViewResultWithConcerns(['auth', 'build', 'cache']),
    });

    render(<DependencyFilters />);

    expect(screen.getByRole('button', { name: 'auth' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /next concern tags/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /previous concern tags/i })).toBeNull();
  });
});
