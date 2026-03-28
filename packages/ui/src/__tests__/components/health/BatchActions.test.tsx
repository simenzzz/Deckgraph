import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BatchActions } from '@/components/health/BatchActions';
import { useActionStore } from '@/stores/actionStore';
import type { OutdatedDep, UnusedDep } from '@/hooks/useHealthReport';

const outdatedDeps: OutdatedDep[] = [
  { name: 'react', ecosystem: 'npm', version: '18.0.0', latestVersion: '19.0.0', severity: 'major-behind', modulePath: 'packages/app' },
  { name: 'lodash', ecosystem: 'npm', version: '4.17.20', latestVersion: '4.17.21', severity: 'patch-behind', modulePath: 'packages/app' },
];

const unusedDeps: UnusedDep[] = [
  { name: 'leftpad', ecosystem: 'npm', scope: 'runtime', modulePath: 'packages/app', moduleName: 'app' },
];

describe('BatchActions', () => {
  beforeEach(() => {
    useActionStore.setState({
      inProgress: new Map(),
      lastResult: null,
      batchResults: [],
      isBatchRunning: false,
    });
  });

  it('renders both batch action buttons', () => {
    render(<BatchActions outdatedDeps={outdatedDeps} unusedDeps={unusedDeps} wsClient={null} />);
    expect(screen.getByTestId('batch-update-all')).toBeInTheDocument();
    expect(screen.getByTestId('batch-remove-all')).toBeInTheDocument();
  });

  it('shows counts in button text', () => {
    render(<BatchActions outdatedDeps={outdatedDeps} unusedDeps={unusedDeps} wsClient={null} />);
    expect(screen.getByTestId('batch-update-all').textContent).toContain('2');
    expect(screen.getByTestId('batch-remove-all').textContent).toContain('1');
  });

  it('disables buttons when no items', () => {
    render(<BatchActions outdatedDeps={[]} unusedDeps={[]} wsClient={null} />);
    expect(screen.getByTestId('batch-update-all')).toBeDisabled();
    expect(screen.getByTestId('batch-remove-all')).toBeDisabled();
  });

  it('disables buttons when batch is running', () => {
    useActionStore.setState({ isBatchRunning: true });
    render(<BatchActions outdatedDeps={outdatedDeps} unusedDeps={unusedDeps} wsClient={null} />);
    expect(screen.getByTestId('batch-update-all')).toBeDisabled();
    expect(screen.getByTestId('batch-remove-all')).toBeDisabled();
  });

  it('opens update confirmation dialog', () => {
    render(<BatchActions outdatedDeps={outdatedDeps} unusedDeps={unusedDeps} wsClient={null} />);
    fireEvent.click(screen.getByTestId('batch-update-all'));
    expect(screen.getByTestId('batch-confirmation')).toBeInTheDocument();
    expect(screen.getByText(/Update 2 Outdated/)).toBeInTheDocument();
  });

  it('opens remove confirmation dialog', () => {
    render(<BatchActions outdatedDeps={outdatedDeps} unusedDeps={unusedDeps} wsClient={null} />);
    fireEvent.click(screen.getByTestId('batch-remove-all'));
    expect(screen.getByTestId('batch-confirmation')).toBeInTheDocument();
    expect(screen.getByText(/Remove 1 Unused/)).toBeInTheDocument();
  });

  it('shows batch results after completion', () => {
    render(<BatchActions outdatedDeps={outdatedDeps} unusedDeps={unusedDeps} wsClient={null} />);
    fireEvent.click(screen.getByTestId('batch-update-all'));
    expect(screen.getByTestId('batch-confirmation')).toBeInTheDocument();

    // Simulate results arriving while dialog is open (batch completes)
    act(() => {
      useActionStore.setState({
        isBatchRunning: false,
        batchResults: [
          { action: 'update', ecosystem: 'npm', packageName: 'react', modulePath: 'packages/app', status: 'success', previousVersion: '18.0.0', newVersion: '19.0.0', error: null, command: 'pnpm add react@19.0.0' },
          { action: 'update', ecosystem: 'npm', packageName: 'lodash', modulePath: 'packages/app', status: 'failure', previousVersion: '4.17.20', newVersion: null, error: 'not found', command: 'pnpm add lodash@4.17.21' },
        ],
      });
    });

    expect(screen.getByTestId('batch-results')).toBeInTheDocument();
    expect(screen.getByText('1 succeeded')).toBeInTheDocument();
    expect(screen.getByText('1 failed')).toBeInTheDocument();
  });
});
