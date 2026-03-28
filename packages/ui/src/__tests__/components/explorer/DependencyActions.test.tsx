import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DependencyActions } from '@/components/explorer/DependencyActions';
import { useActionStore } from '@/stores/actionStore';
import type { Dependency } from '@deckgraph/shared';

const baseDep: Dependency = {
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
};

const outdatedDep: Dependency = {
  ...baseDep,
  registryMeta: {
    latestVersion: '19.0.0',
    description: '',
    license: 'MIT',
    homepage: null,
    downloads: null,
    deprecated: false,
    publishedAt: null,
  },
};

describe('DependencyActions', () => {
  beforeEach(() => {
    useActionStore.setState({
      inProgress: new Map(),
      lastResult: null,
      batchResults: [],
      isBatchRunning: false,
    });
  });

  it('renders Remove button for any dependency', () => {
    render(<DependencyActions dep={baseDep} modulePath="packages/app" wsClient={null} />);
    expect(screen.getByTestId('action-remove-react')).toBeInTheDocument();
  });

  it('does not render Update button for non-outdated dep', () => {
    render(<DependencyActions dep={baseDep} modulePath="packages/app" wsClient={null} />);
    expect(screen.queryByTestId('action-update-react')).not.toBeInTheDocument();
  });

  it('renders Update button for outdated dep with registry data', () => {
    render(<DependencyActions dep={outdatedDep} modulePath="packages/app" wsClient={null} />);
    expect(screen.getByTestId('action-update-react')).toBeInTheDocument();
  });

  it('opens remove confirmation dialog on Remove click', () => {
    render(<DependencyActions dep={baseDep} modulePath="packages/app" wsClient={null} />);
    fireEvent.click(screen.getByTestId('action-remove-react'));
    expect(screen.getByTestId('remove-confirmation')).toBeInTheDocument();
    expect(screen.getByText('Remove react')).toBeInTheDocument();
  });

  it('shows no-analysis warning in remove dialog when usedInFiles is null', () => {
    render(<DependencyActions dep={baseDep} modulePath="packages/app" wsClient={null} />);
    fireEvent.click(screen.getByTestId('action-remove-react'));
    expect(screen.getByTestId('remove-no-analysis-warning')).toBeInTheDocument();
  });

  it('shows usage warning in remove dialog when dep is used', () => {
    const usedDep: Dependency = { ...baseDep, usedInFiles: ['src/App.tsx', 'src/main.tsx'] };
    render(<DependencyActions dep={usedDep} modulePath="packages/app" wsClient={null} />);
    fireEvent.click(screen.getByTestId('action-remove-react'));
    expect(screen.getByTestId('remove-usage-warning')).toBeInTheDocument();
    expect(screen.getByText(/imported in 2 files/)).toBeInTheDocument();
  });

  it('shows no warnings when usedInFiles is empty (unused)', () => {
    const unusedDep: Dependency = { ...baseDep, usedInFiles: [] };
    render(<DependencyActions dep={unusedDep} modulePath="packages/app" wsClient={null} />);
    fireEvent.click(screen.getByTestId('action-remove-react'));
    expect(screen.queryByTestId('remove-usage-warning')).not.toBeInTheDocument();
    expect(screen.queryByTestId('remove-no-analysis-warning')).not.toBeInTheDocument();
  });
});
