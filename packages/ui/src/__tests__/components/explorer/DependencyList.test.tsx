import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DependencyList } from '@/components/explorer/DependencyList';
import { useViewStore } from '@/stores/viewStore';
import { useDetailStore } from '@/stores/detailStore';
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
    expect(screen.getByText('runtime')).toBeInTheDocument();
    expect(screen.getByText('dev')).toBeInTheDocument();
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
});
