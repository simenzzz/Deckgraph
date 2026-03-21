import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ProjectOverview } from '@/components/overview/ProjectOverview';
import { useProjectStore } from '@/stores/projectStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useViewStore } from '@/stores/viewStore';
import { useFilterStore } from '@/stores/filterStore';
import type { Project } from '@deckgraph/shared';

const mockProject: Project = {
  root: '/test/project',
  config: null,
  modules: [
    { path: 'pkg/a', name: 'a', ecosystem: 'npm', manifests: ['package.json'], dependencies: [
      { name: 'react', ecosystem: 'npm', version: '19.0.0', constraint: '^19', scope: 'runtime', source: 'manifest', concerns: [], usedInFiles: null, transitiveDeps: null, registryMeta: null },
    ], analysisState: 'manifest-only' },
    { path: 'pkg/b', name: 'b', ecosystem: 'pypi', manifests: ['pyproject.toml'], dependencies: [], analysisState: 'manifest-only' },
  ],
  crossEdges: [],
  lastScannedAt: '2024-01-01T00:00:00.000Z',
};

describe('ProjectOverview', () => {
  beforeEach(() => {
    useProjectStore.setState({ project: null, isScanning: false, lastProgress: null });
    useConnectionStore.setState({ status: 'connected', lastError: null });
    useViewStore.setState({ result: null, isLoading: false, selectedModulePath: null, currentView: 'overview' });
    useFilterStore.getState().resetFilters();
  });

  afterEach(() => cleanup());

  it('shows ScanPrompt when no project', () => {
    render(<ProjectOverview wsClient={null} />);
    expect(screen.getByText('No project scanned')).toBeInTheDocument();
  });

  it('shows ecosystem cards when project is loaded', () => {
    useProjectStore.setState({ project: mockProject });
    render(<ProjectOverview wsClient={null} />);
    // Both npm and PyPI cards should be present
    expect(screen.getByText('npm')).toBeInTheDocument();
    expect(screen.getByText('PyPI')).toBeInTheDocument();
  });

  it('shows health summary', () => {
    useProjectStore.setState({ project: mockProject });
    render(<ProjectOverview wsClient={null} />);
    expect(screen.getByText('Health Summary')).toBeInTheDocument();
  });

  it('only shows ecosystems with modules', () => {
    useProjectStore.setState({ project: mockProject });
    render(<ProjectOverview wsClient={null} />);
    // Cargo/Go/Maven have no modules, their card titles should not appear
    expect(screen.queryByText('Cargo')).toBeNull();
    expect(screen.queryByText('Maven')).toBeNull();
  });
});
