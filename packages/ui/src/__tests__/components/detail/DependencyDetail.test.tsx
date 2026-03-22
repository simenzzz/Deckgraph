import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DependencyDetail } from '@/components/detail/DependencyDetail';
import { useDetailStore } from '@/stores/detailStore';
import { useProjectStore } from '@/stores/projectStore';
import type { Project } from '@deckgraph/shared';

const mockProject: Project = {
  root: '/test',
  config: null,
  modules: [
    {
      path: 'packages/app',
      name: 'app',
      ecosystem: 'npm',
      manifests: ['package.json'],
      dependencies: [
        {
          name: 'react',
          ecosystem: 'npm',
          version: '18.0.0',
          constraint: '^18',
          scope: 'runtime',
          source: 'manifest',
          concerns: [],
          usedInFiles: null,
          transitiveDeps: null,
          registryMeta: null,
        },
      ],
      analysisState: 'manifest-only',
    },
  ],
  crossEdges: [],
  lastScannedAt: '2024-01-01T00:00:00.000Z',
};

describe('DependencyDetail', () => {
  beforeEach(() => {
    useDetailStore.setState({ selectedDep: null, isEnriching: false });
    useProjectStore.setState({ project: null, isScanning: false, lastProgress: null });
  });

  it('shows not found when dependency missing', () => {
    useDetailStore.setState({ selectedDep: { name: 'nonexistent', ecosystem: 'npm' } });
    render(<DependencyDetail wsClient={null} />);
    expect(screen.getByText('Dependency not found.')).toBeInTheDocument();
  });

  it('renders dependency detail panel', () => {
    useProjectStore.getState().setProject(mockProject);
    useDetailStore.getState().selectDep({ name: 'react', ecosystem: 'npm' });

    render(<DependencyDetail wsClient={null} />);
    expect(screen.getByTestId('dependency-detail')).toBeInTheDocument();
    expect(screen.getByText('react')).toBeInTheDocument();
    expect(screen.getByText('npm')).toBeInTheDocument();
  });

  it('back button calls closeDep', () => {
    useProjectStore.getState().setProject(mockProject);
    useDetailStore.getState().selectDep({ name: 'react', ecosystem: 'npm' });

    render(<DependencyDetail wsClient={null} />);
    fireEvent.click(screen.getByTestId('detail-back'));
    expect(useDetailStore.getState().selectedDep).toBeNull();
  });

  it('shows registry section with fetch button when not enriched', () => {
    useProjectStore.getState().setProject(mockProject);
    useDetailStore.getState().selectDep({ name: 'react', ecosystem: 'npm' });

    render(<DependencyDetail wsClient={null} />);
    expect(screen.getByText('Registry data not yet loaded.')).toBeInTheDocument();
  });

  it('shows usage section with not-analyzed message', () => {
    useProjectStore.getState().setProject(mockProject);
    useDetailStore.getState().selectDep({ name: 'react', ecosystem: 'npm' });

    render(<DependencyDetail wsClient={null} />);
    expect(screen.getByTestId('usage-not-analyzed')).toBeInTheDocument();
  });

  it('shows transitive deps section with not-available message', () => {
    useProjectStore.getState().setProject(mockProject);
    useDetailStore.getState().selectDep({ name: 'react', ecosystem: 'npm' });

    render(<DependencyDetail wsClient={null} />);
    expect(screen.getByTestId('transitive-not-available')).toBeInTheDocument();
  });
});
