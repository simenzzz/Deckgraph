import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ProjectOverview } from '@/components/overview/ProjectOverview';
import { useProjectStore } from '@/stores/projectStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useViewStore } from '@/stores/viewStore';
import { useFilterStore } from '@/stores/filterStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { Project } from '@deckgraph/shared';
import type { WsClient } from '@/lib/wsClient';

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

function createMockWsClient(): WsClient {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn(() => true),
    getStatus: vi.fn(() => 'connected' as const),
  };
}

describe('ProjectOverview', () => {
  beforeEach(() => {
    useProjectStore.setState({ project: null, isScanning: false, lastProgress: null, fileChangeInProgress: false });
    useConnectionStore.setState({
      status: 'connected',
      lastError: null,
      lastErrorSuggestion: null,
      configPresent: true,
      hasScannedData: false,
      demoMode: false,
      demoRepositories: [],
    });
    useViewStore.setState({ result: null, isLoading: false, selectedModulePath: null, currentView: 'overview' });
    useWorkspaceStore.setState({ workspace: null, activeProjectRoot: null });
    useFilterStore.getState().resetFilters();
  });

  afterEach(() => cleanup());

  it('shows ScanPrompt when no project', () => {
    render(<ProjectOverview wsClient={null} />);
    expect(screen.getByText('No project scanned')).toBeInTheDocument();
  });

  it('shows demo repository choices in hosted demo mode', () => {
    useConnectionStore.setState({
      demoMode: true,
      demoRepositories: [{
        id: 'deckgraph-fixture',
        label: 'Deckgraph Fixture',
        url: 'https://github.com/simenzzz/Deckgraph.git',
        description: 'A public demo repository.',
      }],
    });

    render(<ProjectOverview wsClient={null} />);

    expect(screen.getByRole('heading', { name: /choose a repository to scan/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /deckgraph fixture/i })).toBeInTheDocument();
  });

  it('shows a fallback when hosted demo mode has no repositories', () => {
    useConnectionStore.setState({
      demoMode: true,
      demoRepositories: [],
    });

    render(<ProjectOverview wsClient={null} />);

    expect(screen.getByText('No demo repositories configured')).toBeInTheDocument();
  });

  it('sends import_demo_repo when a demo repository is selected', () => {
    const client = createMockWsClient();
    useConnectionStore.setState({
      demoMode: true,
      demoRepositories: [{
        id: 'deckgraph-fixture',
        label: 'Deckgraph Fixture',
        url: 'https://github.com/simenzzz/Deckgraph.git',
        description: 'A public demo repository.',
      }],
    });

    render(<ProjectOverview wsClient={client} />);
    fireEvent.click(screen.getByRole('button', { name: /import demo/i }));

    expect(client.send).toHaveBeenCalledWith(expect.objectContaining({
      type: 'import_demo_repo',
      repoId: 'deckgraph-fixture',
    }));
  });

  it('sends import_public_github_repo when a public GitHub URL is submitted', () => {
    const client = createMockWsClient();
    useConnectionStore.setState({
      demoMode: true,
      demoRepositories: [{
        id: 'deckgraph-fixture',
        label: 'Deckgraph Fixture',
        url: 'https://github.com/simenzzz/Deckgraph.git',
        description: 'A public demo repository.',
      }],
    });

    render(<ProjectOverview wsClient={client} />);
    fireEvent.change(screen.getByLabelText(/public github repository url/i), {
      target: { value: 'https://github.com/example/demo-repo' },
    });
    fireEvent.click(screen.getByRole('button', { name: /scan github repo/i }));

    expect(client.send).toHaveBeenCalledWith(expect.objectContaining({
      type: 'import_public_github_repo',
      url: 'https://github.com/example/demo-repo',
    }));
  });

  it('renders session custom repositories next to curated demo repositories', () => {
    useConnectionStore.setState({
      demoMode: true,
      demoRepositories: [
        {
          id: 'deckgraph-fixture',
          label: 'Deckgraph Fixture',
          url: 'https://github.com/simenzzz/Deckgraph.git',
          description: 'A public demo repository.',
        },
        {
          id: 'custom-example-demo-repo',
          label: 'example/demo-repo',
          url: 'https://github.com/example/demo-repo.git',
          description: 'README snippet from the imported repository.',
        },
      ],
    });

    render(<ProjectOverview wsClient={null} />);

    expect(screen.getByRole('heading', { name: /deckgraph fixture/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /example\/demo-repo/i })).toBeInTheDocument();
    expect(screen.getByText('README snippet from the imported repository.')).toBeInTheDocument();
  });

  it('shows ecosystem cards when project is loaded', () => {
    useProjectStore.setState({ project: mockProject });
    render(<ProjectOverview wsClient={null} />);
    // Both npm and PyPI cards should be present
    expect(screen.getByText('npm')).toBeInTheDocument();
    expect(screen.getByText('PyPI')).toBeInTheDocument();
  });

  it('shows a workspace-level overview when all projects are selected', () => {
    const secondProject: Project = {
      ...mockProject,
      root: '/test/service',
      modules: [
        { path: 'service', name: 'service', ecosystem: 'go', manifests: ['go.mod'], dependencies: [], analysisState: 'manifest-only' },
      ],
    };
    useWorkspaceStore.setState({
      workspace: {
        config: null,
        projects: [mockProject, secondProject],
        crossRootDeps: [],
        lastScannedAt: '2024-01-01T00:00:00.000Z',
      },
      activeProjectRoot: null,
    });

    render(<ProjectOverview wsClient={null} />);

    expect(screen.getByRole('heading', { name: /workspace overview/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /npm: 1 module/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go: 1 module/i })).toBeInTheDocument();
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
