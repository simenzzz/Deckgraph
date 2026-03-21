import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from '@/components/layout/Header';
import { useProjectStore } from '@/stores/projectStore';
import { useConnectionStore } from '@/stores/connectionStore';
import type { WsClient } from '@/lib/wsClient';
import type { Project } from '@deckgraph/shared';

const mockProject: Project = {
  root: '/test/my-app',
  config: null,
  modules: [
    { path: 'pkg/a', name: 'a', ecosystem: 'npm', manifests: ['package.json'], dependencies: [], analysisState: 'manifest-only' },
    { path: 'pkg/b', name: 'b', ecosystem: 'npm', manifests: ['package.json'], dependencies: [], analysisState: 'manifest-only' },
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

describe('Header', () => {
  beforeEach(() => {
    useProjectStore.setState({ project: null, isScanning: false, lastProgress: null });
    useConnectionStore.setState({ status: 'connected', lastError: null });
  });

  it('shows Deckgraph when no project', () => {
    render(<Header wsClient={null} />);
    expect(screen.getByText('Deckgraph')).toBeInTheDocument();
  });

  it('shows project name and module count when project is loaded', () => {
    useProjectStore.setState({ project: mockProject });
    render(<Header wsClient={null} />);
    expect(screen.getByText('my-app')).toBeInTheDocument();
    expect(screen.getByText('2 modules')).toBeInTheDocument();
  });

  it('disables scan button when disconnected', () => {
    useConnectionStore.setState({ status: 'disconnected' });
    render(<Header wsClient={null} />);
    expect(screen.getByText('Scan')).toBeDisabled();
  });

  it('sends scan_project on button click', () => {
    const client = createMockWsClient();
    render(<Header wsClient={client} />);

    fireEvent.click(screen.getByText('Scan'));
    expect(client.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'scan_project' }),
    );
  });

  it('shows Scanning... while scanning', () => {
    useProjectStore.setState({ isScanning: true });
    render(<Header wsClient={null} />);
    expect(screen.getByText('Scanning...')).toBeInTheDocument();
  });
});
