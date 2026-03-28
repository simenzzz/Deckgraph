import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InstallDialog } from '@/components/explorer/InstallDialog';
import { useActionStore } from '@/stores/actionStore';

describe('InstallDialog', () => {
  beforeEach(() => {
    useActionStore.setState({
      inProgress: new Map(),
      lastResult: null,
      batchResults: [],
      isBatchRunning: false,
    });
  });

  const defaultProps = {
    open: true,
    onOpenChange: () => {},
    modulePath: 'packages/app',
    moduleName: 'app',
    moduleEcosystem: 'npm' as const,
    wsClient: null,
  };

  it('renders dialog with form fields', () => {
    render(<InstallDialog {...defaultProps} />);
    expect(screen.getByText('Install Package')).toBeInTheDocument();
    expect(screen.getByTestId('install-package-name')).toBeInTheDocument();
    expect(screen.getByTestId('install-version')).toBeInTheDocument();
    expect(screen.getByTestId('install-scope')).toBeInTheDocument();
  });

  it('shows ecosystem badge', () => {
    render(<InstallDialog {...defaultProps} />);
    expect(screen.getByText('npm')).toBeInTheDocument();
  });

  it('disables Install button when package name is empty', () => {
    render(<InstallDialog {...defaultProps} />);
    const btn = screen.getByTestId('confirm-install');
    expect(btn).toBeDisabled();
  });

  it('enables Install button when package name is entered', () => {
    render(<InstallDialog {...defaultProps} />);
    fireEvent.change(screen.getByTestId('install-package-name'), { target: { value: 'lodash' } });
    const btn = screen.getByTestId('confirm-install');
    expect(btn).not.toBeDisabled();
  });

  it('shows scope options', () => {
    render(<InstallDialog {...defaultProps} />);
    const select = screen.getByTestId('install-scope') as HTMLSelectElement;
    expect(select.options).toHaveLength(5);
    expect(select.value).toBe('runtime');
  });

  it('shows result when install completes', () => {
    useActionStore.setState({
      inProgress: new Map(),
      lastResult: {
        action: 'install',
        ecosystem: 'npm',
        packageName: 'lodash',
        modulePath: 'packages/app',
        status: 'success',
        previousVersion: null,
        newVersion: '4.17.21',
        error: null,
        command: 'pnpm add lodash',
      },
    });

    render(<InstallDialog {...defaultProps} />);
    // Type "lodash" so the result is considered relevant
    fireEvent.change(screen.getByTestId('install-package-name'), { target: { value: 'lodash' } });
    expect(screen.getByTestId('install-result')).toBeInTheDocument();
    expect(screen.getByText('Install successful')).toBeInTheDocument();
  });
});
