import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HealthReport } from '@/components/health/HealthReport';
import { useProjectStore } from '@/stores/projectStore';
import { useFilterStore } from '@/stores/filterStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useDetailStore } from '@/stores/detailStore';
import { useHealthPrereqStore } from '@/stores/healthPrereqStore';
import { useViewStore } from '@/stores/viewStore';
import type { Project } from '@deckgraph/shared';

const emptyProject: Project = {
  root: '/test',
  config: null,
  modules: [],
  crossEdges: [],
  lastScannedAt: '2024-01-01T00:00:00.000Z',
};

describe('HealthReport', () => {
  beforeEach(() => {
    useProjectStore.setState({ project: null, isScanning: false, lastProgress: null });
    useFilterStore.setState({ ecosystems: [], scopes: [], search: '', moduleSearch: '', concern: null });
    useConnectionStore.setState({ status: 'connected' });
    useDetailStore.setState({ selectedDep: null, isEnriching: false, enrichmentRequestId: null, enrichError: null });
    useHealthPrereqStore.getState().reset();
    useViewStore.setState({ currentView: 'overview', selectedModulePath: null });
  });

  it('renders health report container', () => {
    render(<HealthReport wsClient={null} />);
    expect(screen.getByTestId('health-report')).toBeInTheDocument();
    expect(screen.getByText('Health Report')).toBeInTheDocument();
  });

  it('renders all three tabs', () => {
    render(<HealthReport wsClient={null} />);
    expect(screen.getByTestId('tab-outdated')).toBeInTheDocument();
    expect(screen.getByTestId('tab-unused')).toBeInTheDocument();
    expect(screen.getByTestId('tab-licenses')).toBeInTheDocument();
  });

  it('shows outdated tab by default', () => {
    useProjectStore.getState().setProject(emptyProject);
    render(<HealthReport wsClient={null} />);
    // Default tab is outdated, which shows "no registry data" message
    expect(screen.getByTestId('outdated-no-data')).toBeInTheDocument();
  });

  it('opens the first registry target in Module Explorer from the empty state', () => {
    useProjectStore.getState().setProject({
      ...emptyProject,
      modules: [
        {
          path: 'pkg/a',
          name: 'a',
          ecosystem: 'npm',
          manifests: ['package.json'],
          analysisState: 'manifest-only',
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
        },
      ],
    });

    render(<HealthReport wsClient={null} />);
    fireEvent.click(screen.getByTestId('outdated-no-data-open-explorer'));

    expect(useViewStore.getState().currentView).toBe('explorer');
    expect(useViewStore.getState().selectedModulePath).toBe('pkg/a');
    expect(useDetailStore.getState().selectedDep).toEqual({ name: 'react', ecosystem: 'npm' });
  });

  it('shows count badge when there are outdated deps', () => {
    const project: Project = {
      ...emptyProject,
      modules: [
        {
          path: 'pkg/a',
          name: 'a',
          ecosystem: 'npm',
          manifests: ['package.json'],
          analysisState: 'manifest-only',
          dependencies: [
            {
              name: 'old-pkg',
              ecosystem: 'npm',
              version: '1.0.0',
              constraint: '^1',
              scope: 'runtime',
              source: 'manifest',
              concerns: [],
              usedInFiles: null,
              transitiveDeps: null,
              registryMeta: {
                latestVersion: '3.0.0',
                description: '',
                license: 'MIT',
                homepage: null,
                downloads: null,
                deprecated: false,
                publishedAt: null,
              },
            },
          ],
        },
      ],
    };
    useProjectStore.getState().setProject(project);
    render(<HealthReport wsClient={null} />);
    expect(screen.getByTestId('tab-outdated').textContent).toContain('1');
  });
});
