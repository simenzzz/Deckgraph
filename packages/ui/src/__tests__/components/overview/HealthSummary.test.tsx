import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HealthSummary } from '@/components/overview/HealthSummary';
import type { Project } from '@deckgraph/shared';

const mockProject: Project = {
  root: '/test',
  config: null,
  modules: [
    {
      path: 'pkg/a', name: 'a', ecosystem: 'npm', manifests: ['package.json'],
      dependencies: [
        { name: 'react', ecosystem: 'npm', version: '19.0.0', constraint: '^19', scope: 'runtime', source: 'manifest', concerns: [], usedInFiles: null, transitiveDeps: null, registryMeta: null },
        { name: 'vite', ecosystem: 'npm', version: '6.0.0', constraint: '^6', scope: 'dev', source: 'manifest', concerns: [], usedInFiles: null, transitiveDeps: null, registryMeta: null },
      ],
      analysisState: 'manifest-only',
    },
  ],
  crossEdges: [],
  lastScannedAt: '2024-01-01T00:00:00.000Z',
};

describe('HealthSummary', () => {
  it('renders all stat labels', () => {
    render(<HealthSummary project={mockProject} />);
    expect(screen.getByText('Modules')).toBeInTheDocument();
    expect(screen.getByText('Total Deps')).toBeInTheDocument();
    expect(screen.getByText('Runtime')).toBeInTheDocument();
    expect(screen.getByText('Dev')).toBeInTheDocument();
  });

  it('shows correct total dep count', () => {
    render(<HealthSummary project={mockProject} />);
    // "2" appears next to "Total Deps"
    const totalDepsLabel = screen.getByText('Total Deps');
    const parent = totalDepsLabel.parentElement!;
    expect(parent.querySelector('dd')!.textContent).toBe('2');
  });

  it('shows Health Summary title', () => {
    render(<HealthSummary project={mockProject} />);
    expect(screen.getByText('Health Summary')).toBeInTheDocument();
  });
});
