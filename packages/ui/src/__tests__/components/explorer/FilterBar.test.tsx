import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterBar } from '@/components/explorer/FilterBar';
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

describe('FilterBar', () => {
  beforeEach(() => {
    useFilterStore.getState().resetFilters();
    useViewStore.setState({
      result: null,
      isLoading: false,
      selectedModulePath: null,
      currentView: 'explorer',
      analyzingModulePath: null,
      analysisRequestId: null,
    });
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

    render(<FilterBar />);

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

    render(<FilterBar />);

    expect(screen.getByRole('button', { name: 'auth' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /next concern tags/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /previous concern tags/i })).toBeNull();
  });
});
