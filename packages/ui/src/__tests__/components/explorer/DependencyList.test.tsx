import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { DependencyList } from '@/components/explorer/DependencyList';
import { useViewStore } from '@/stores/viewStore';
import { useDetailStore } from '@/stores/detailStore';
import { useConnectionStore } from '@/stores/connectionStore';
import type { ViewResult } from '@deckgraph/shared';

const mockResult: ViewResult = {
  modules: [
    {
      path: 'packages/app',
      name: 'app',
      ecosystem: 'npm',
      analysisState: 'manifest-only',
      dependencies: [
        { name: 'react', ecosystem: 'npm', version: '19.0.0', constraint: '^19', scope: 'runtime', source: 'manifest', concerns: [], usedInFiles: null, transitiveDeps: null, registryMeta: null },
        { name: 'vitest', ecosystem: 'npm', version: '2.1.8', constraint: '^2', scope: 'dev', source: 'manifest', concerns: [], usedInFiles: null, transitiveDeps: null, registryMeta: null },
      ],
      totalDependencyCount: 2,
    },
  ],
  crossEdges: [],
  summary: {
    totalDeps: 2,
    byEcosystem: { npm: 2, pypi: 0, cargo: 0, go: 0, maven: 0 },
    byScope: { runtime: 1, dev: 1, build: 0, optional: 0, peer: 0 },
    outdatedCount: null,
    unusedCount: null,
    moduleCount: 1,
    crossEdgeCount: 0,
  },
};

describe('DependencyList', () => {
  beforeEach(() => {
    useViewStore.setState({
      result: null,
      isLoading: false,
      selectedModulePath: null,
      currentView: 'explorer',
    });
    useDetailStore.setState({ selectedDep: null, isEnriching: false });
    useConnectionStore.setState({
      status: 'connected',
      lastError: null,
      lastErrorSuggestion: null,
      configPresent: true,
      hasScannedData: true,
      demoMode: false,
      demoRepositories: [],
    });
  });

  it('shows prompt when no module selected', () => {
    render(<DependencyList wsClient={null} />);
    expect(screen.getByText(/Select a module/)).toBeInTheDocument();
  });

  it('renders dependencies for selected module', () => {
    useViewStore.setState({ result: mockResult, selectedModulePath: 'packages/app' });
    render(<DependencyList wsClient={null} />);

    expect(screen.getByText('react')).toBeInTheDocument();
    expect(screen.getByText('vitest')).toBeInTheDocument();
    expect(screen.getByText('19.0.0')).toBeInTheDocument();
  });

  it('shows module name and dep count', () => {
    useViewStore.setState({ result: mockResult, selectedModulePath: 'packages/app' });
    render(<DependencyList wsClient={null} />);
    expect(screen.getByText('app')).toBeInTheDocument();
    expect(screen.getByText('2 deps')).toBeInTheDocument();
  });

  it('shows scope badges', () => {
    useViewStore.setState({ result: mockResult, selectedModulePath: 'packages/app' });
    render(<DependencyList wsClient={null} />);
    // Scope text also appears in the DependencyFilters toggles, so scope the
    // assertion to the dependency table.
    const table = screen.getByRole('table');
    expect(within(table).getByText('runtime')).toBeInTheDocument();
    expect(within(table).getByText('dev')).toBeInTheDocument();
  });

  it('renders dependency filters when a module is selected', () => {
    useViewStore.setState({ result: mockResult, selectedModulePath: 'packages/app' });
    render(<DependencyList wsClient={null} />);
    expect(screen.getByPlaceholderText('Search dependencies...')).toBeInTheDocument();
  });

  it('keeps dependency filters visible when no deps match', () => {
    const emptyResult: ViewResult = {
      ...mockResult,
      modules: [{ ...mockResult.modules[0], dependencies: [] }],
    };
    useViewStore.setState({ result: emptyResult, selectedModulePath: 'packages/app' });
    render(<DependencyList wsClient={null} />);

    expect(screen.getByPlaceholderText('Search dependencies...')).toBeInTheDocument();
    expect(screen.getByText(/No dependencies match/)).toBeInTheDocument();
  });

  it('clicking dep name sets detailStore selection', () => {
    useViewStore.setState({ result: mockResult, selectedModulePath: 'packages/app' });
    render(<DependencyList wsClient={null} />);

    fireEvent.click(screen.getByTestId('dep-link-react'));
    const state = useDetailStore.getState();
    expect(state.selectedDep).toEqual({ name: 'react', ecosystem: 'npm' });
  });

  it('dep names are rendered as clickable links', () => {
    useViewStore.setState({ result: mockResult, selectedModulePath: 'packages/app' });
    render(<DependencyList wsClient={null} />);

    expect(screen.getByTestId('dep-link-react')).toBeInTheDocument();
    expect(screen.getByTestId('dep-link-vitest')).toBeInTheDocument();
  });

  it('hides install controls in hosted demo mode', () => {
    useConnectionStore.setState({ demoMode: true });
    useViewStore.setState({ result: mockResult, selectedModulePath: 'packages/app' });

    render(<DependencyList wsClient={null} />);

    expect(screen.queryByTestId('install-package-button')).not.toBeInTheDocument();
  });
});
