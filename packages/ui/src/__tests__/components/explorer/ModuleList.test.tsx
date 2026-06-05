import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModuleList } from '@/components/explorer/ModuleList';
import { useViewStore } from '@/stores/viewStore';
import { useFilterStore } from '@/stores/filterStore';
import type { ViewResult } from '@deckgraph/shared';
import type { WsClient } from '@/lib/wsClient';

function createMockWsClient() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn().mockReturnValue(true),
    getStatus: vi.fn().mockReturnValue('connected' as const),
  };
}

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
      analyzingModulePath: null,
      analysisRequestId: null,
    });
    useFilterStore.getState().resetFilters();
  });

  it('shows empty state when no modules', () => {
    render(<ModuleList wsClient={null} />);
    expect(screen.getByText(/No modules match/)).toBeInTheDocument();
  });

  it('renders module rows', () => {
    useViewStore.setState({ result: mockResult });
    render(<ModuleList wsClient={null} />);
    expect(screen.getByText('backend')).toBeInTheDocument();
    expect(screen.getByText('lib')).toBeInTheDocument();
  });

  it('selects module on click', () => {
    useViewStore.setState({ result: mockResult });
    render(<ModuleList wsClient={null} />);

    fireEvent.click(screen.getByTestId('module-packages/backend'));
    expect(useViewStore.getState().selectedModulePath).toBe('packages/backend');
  });

  it('shows dep count with filtered/total', () => {
    useViewStore.setState({ result: mockResult });
    render(<ModuleList wsClient={null} />);
    // Verify through test id
    const row = screen.getByTestId('module-packages/backend');
    expect(row.textContent).toContain('/5');
  });

  it('filters modules by name via module search', () => {
    useViewStore.setState({ result: mockResult });
    useFilterStore.getState().setModuleSearch('backend');
    render(<ModuleList wsClient={null} />);

    expect(screen.getByText('backend')).toBeInTheDocument();
    expect(screen.queryByText('lib')).toBeNull();
  });

  it('filters modules by path via module search', () => {
    useViewStore.setState({ result: mockResult });
    useFilterStore.getState().setModuleSearch('packages/lib');
    render(<ModuleList wsClient={null} />);

    expect(screen.getByText('lib')).toBeInTheDocument();
    expect(screen.queryByText('backend')).toBeNull();
  });

  it('shows empty state when module search matches nothing', () => {
    useViewStore.setState({ result: mockResult });
    useFilterStore.getState().setModuleSearch('nonexistent-module');
    render(<ModuleList wsClient={null} />);

    expect(screen.getByText(/No modules match/)).toBeInTheDocument();
  });

  it('sends analyze_imports for manifest-only modules', () => {
    const client = createMockWsClient();
    useViewStore.setState({ result: mockResult });
    render(<ModuleList wsClient={client as unknown as WsClient} />);

    fireEvent.click(screen.getByTestId('analyze-module-packages/backend'));

    expect(client.send).toHaveBeenCalledWith(expect.objectContaining({
      type: 'analyze_imports',
      modulePath: 'packages/backend',
    }));
    expect(useViewStore.getState().analyzingModulePath).toBe('packages/backend');
  });
});
