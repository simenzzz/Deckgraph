import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConnectionIndicator } from '@/components/layout/ConnectionIndicator';
import { useConnectionStore } from '@/stores/connectionStore';

describe('ConnectionIndicator', () => {
  beforeEach(() => {
    useConnectionStore.setState({
      status: 'disconnected',
      lastError: null,
      lastErrorSuggestion: null,
      configPresent: null,
      hasScannedData: null,
      demoMode: false,
      demoRepositories: [],
    });
  });

  it('shows Disconnected when disconnected', () => {
    render(<ConnectionIndicator />);
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });

  it('shows Connected when connected', () => {
    useConnectionStore.setState({ status: 'connected' });
    render(<ConnectionIndicator />);
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('shows Connecting... when connecting', () => {
    useConnectionStore.setState({ status: 'connecting' });
    render(<ConnectionIndicator />);
    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });

  it('shows Reconnecting... when reconnecting', () => {
    useConnectionStore.setState({ status: 'reconnecting' });
    render(<ConnectionIndicator />);
    expect(screen.getByText('Reconnecting...')).toBeInTheDocument();
  });

  it('renders the indicator dot', () => {
    render(<ConnectionIndicator />);
    expect(screen.getByTestId('connection-indicator')).toBeInTheDocument();
  });
});
