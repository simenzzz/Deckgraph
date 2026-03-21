import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModuleList } from '@/components/explorer/ModuleList';
import { useViewStore } from '@/stores/viewStore';
import type { ViewResult } from '@deckgraph/shared';

const mockResult: ViewResult = {
  modules: [
    {
      path: 'packages/backend',
      name: 'backend',
      ecosystem: 'npm',
      analysisState: 'manifest-only',
      dependencies: [
        { name: 'express', ecosystem: 'npm', version: '4.18.0', constraint: '^4', scope: 'runtime', source: 'manifest', concerns: [], usedInFiles: null, transitiveDeps: null, registryMeta: null },
      ],
      totalDependencyCount: 5,
    },
    {
      path: 'packages/lib',
      name: 'lib',
      ecosystem: 'pypi',
      analysisState: 'manifest-only',
      dependencies: [],
      totalDependencyCount: 3,
    },
  ],
  crossEdges: [],
  summary: {
    totalDeps: 8,
    byEcosystem: { npm: 5, pypi: 3, cargo: 0, go: 0, maven: 0 },
    byScope: { runtime: 5, dev: 3, build: 0, optional: 0, peer: 0 },
    outdatedCount: null,
    unusedCount: null,
    moduleCount: 2,
    crossEdgeCount: 0,
  },
};

describe('ModuleList', () => {
  beforeEach(() => {
    useViewStore.setState({
      result: null,
      isLoading: false,
      selectedModulePath: null,
      currentView: 'explorer',
    });
  });

  it('shows empty state when no modules', () => {
    render(<ModuleList />);
    expect(screen.getByText(/No modules match/)).toBeInTheDocument();
  });

  it('renders module rows', () => {
    useViewStore.setState({ result: mockResult });
    render(<ModuleList />);
    expect(screen.getByText('backend')).toBeInTheDocument();
    expect(screen.getByText('lib')).toBeInTheDocument();
  });

  it('selects module on click', () => {
    useViewStore.setState({ result: mockResult });
    render(<ModuleList />);

    fireEvent.click(screen.getByTestId('module-packages/backend'));
    expect(useViewStore.getState().selectedModulePath).toBe('packages/backend');
  });

  it('shows dep count with filtered/total', () => {
    useViewStore.setState({ result: mockResult });
    render(<ModuleList />);
    // Verify through test id
    const row = screen.getByTestId('module-packages/backend');
    expect(row.textContent).toContain('/5');
  });
});
