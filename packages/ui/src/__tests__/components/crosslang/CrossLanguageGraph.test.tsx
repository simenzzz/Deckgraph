import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CrossLanguageGraph } from '@/components/crosslang/CrossLanguageGraph';
import { useProjectStore } from '@/stores/projectStore';
import { useGraphStore } from '@/stores/graphStore';
import type { Project } from '@deckgraph/shared';

const mockProject: Project = {
  root: '/test',
  config: null,
  modules: [
    {
      path: 'services/api',
      name: 'api-gateway',
      ecosystem: 'npm',
      manifests: ['package.json'],
      dependencies: [],
      analysisState: 'manifest-only',
    },
    {
      path: 'services/auth',
      name: 'auth-service',
      ecosystem: 'pypi',
      manifests: ['pyproject.toml'],
      dependencies: [],
      analysisState: 'manifest-only',
    },
  ],
  crossEdges: [
    {
      from: { module: 'services/api', ecosystem: 'npm' },
      to: { module: 'services/auth', ecosystem: 'pypi' },
      type: 'proto',
      evidence: 'api.proto service definition',
      confidence: 0.8,
    },
  ],
  lastScannedAt: '2024-01-01T00:00:00.000Z',
};

describe('CrossLanguageGraph', () => {
  beforeEach(() => {
    useProjectStore.setState({
      project: null,
      isScanning: false,
      lastProgress: null,
      fileChangeInProgress: false,
    });
    useGraphStore.setState({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      selectedEdgeId: null,
      edgeTypeFilter: new Set(['proto', 'openapi', 'ffi', 'build', 'shared-config']),
      minConfidence: 0,
    });
  });

  it('shows scan prompt when no project', () => {
    render(<CrossLanguageGraph />);
    expect(screen.getByText(/scan a project/i)).toBeInTheDocument();
  });

  it('shows empty state when no cross edges', () => {
    useProjectStore.setState({
      project: { ...mockProject, crossEdges: [] },
    });
    render(<CrossLanguageGraph />);
    expect(screen.getByText(/no cross-language edges/i)).toBeInTheDocument();
  });

  it('renders graph components when project has cross edges', () => {
    useProjectStore.setState({ project: mockProject });
    render(<CrossLanguageGraph />);

    expect(screen.getByTestId('cross-language-graph')).toBeInTheDocument();
    expect(screen.getByTestId('graph-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('cross-edge-filter')).toBeInTheDocument();
  });

  it('renders nodes for modules with cross edges', () => {
    useProjectStore.setState({ project: mockProject });
    render(<CrossLanguageGraph />);

    expect(screen.getByTestId('graph-node-services/api')).toBeInTheDocument();
    expect(screen.getByTestId('graph-node-services/auth')).toBeInTheDocument();
  });
});
