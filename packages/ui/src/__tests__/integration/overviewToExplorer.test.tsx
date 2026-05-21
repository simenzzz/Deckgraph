/**
 * Integration test: full flow from overview to explorer.
 *
 * Mocks the browser WebSocket. Simulates server messages.
 * Verifies the overview renders → navigate to explorer → view results.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { App } from '@/App';
import type { ServerMessage } from '@deckgraph/shared';
import { useConnectionStore } from '@/stores/connectionStore';
import { useProjectStore } from '@/stores/projectStore';
import { useViewStore } from '@/stores/viewStore';
import { useFilterStore } from '@/stores/filterStore';

// --- Mock WebSocket ---
let mockInstance: MockWS | null = null;

class MockWS {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  readyState = MockWS.CONNECTING;
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  sent: string[] = [];

  constructor(_url: string) {
    mockInstance = this;
    setTimeout(() => {
      this.readyState = MockWS.OPEN;
      this.onopen?.({} as Event);
    }, 0);
  }

  send(data: string): boolean {
    this.sent.push(data);
    return true;
  }

  close() {
    this.readyState = MockWS.CLOSED;
    this.onclose?.({ code: 1000, reason: '' } as CloseEvent);
  }

  simulateMessage(msg: ServerMessage) {
    this.onmessage?.({ data: JSON.stringify(msg) } as MessageEvent);
  }
}

beforeEach(() => {
  mockInstance = null;
  vi.stubGlobal('WebSocket', MockWS);
  vi.useFakeTimers();

  // Reset all stores
  useConnectionStore.setState({
    status: 'disconnected',
    lastError: null,
    lastErrorSuggestion: null,
    configPresent: true,
    hasScannedData: false,
    demoMode: false,
    demoRepositories: [],
  });
  useProjectStore.setState({ project: null, isScanning: false, lastProgress: null, fileChangeInProgress: false });
  useViewStore.setState({ result: null, isLoading: false, selectedModulePath: null, currentView: 'overview' });
  useFilterStore.getState().resetFilters();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Overview → Explorer flow', () => {
  it('renders scan prompt initially, then overview after scan, then explorer', async () => {
    render(<App />);

    // WS connects
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    // Initially shows scan prompt
    expect(screen.getByText('No project scanned')).toBeInTheDocument();

    // Simulate scan response
    act(() => {
      mockInstance!.simulateMessage({
        type: 'project_overview',
        requestId: 'r1',
        data: {
          root: '/test/my-app',
          config: null,
          modules: [
            {
              path: 'packages/api',
              name: 'api',
              ecosystem: 'npm',
              manifests: ['package.json'],
              dependencies: [
                { name: 'express', ecosystem: 'npm', version: '4.18.0', constraint: '^4', scope: 'runtime', source: 'manifest', concerns: [], usedInFiles: null, transitiveDeps: null, registryMeta: null },
              ],
              analysisState: 'manifest-only',
            },
          ],
          crossEdges: [],
          lastScannedAt: '2024-01-01T00:00:00.000Z',
        },
      });
    });

    // Overview should show ecosystem card
    expect(screen.getByText('Project Overview')).toBeInTheDocument();
    expect(screen.getByText('npm')).toBeInTheDocument();

    // Navigate to explorer
    fireEvent.click(screen.getByTestId('nav-explorer'));
    // "Module Explorer" appears in both sidebar nav and page heading
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Module Explorer');

    // Wait for view_query to be sent (debounce)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    // Simulate view_result
    act(() => {
      mockInstance!.simulateMessage({
        type: 'view_result',
        requestId: 'r2',
        data: {
          modules: [
            {
              path: 'packages/api',
              name: 'api',
              ecosystem: 'npm',
              analysisState: 'manifest-only',
              dependencies: [
                { name: 'express', ecosystem: 'npm', version: '4.18.0', constraint: '^4', scope: 'runtime', source: 'manifest', concerns: [], usedInFiles: null, transitiveDeps: null, registryMeta: null },
              ],
              totalDependencyCount: 1,
            },
          ],
          crossEdges: [],
          summary: {
            totalDeps: 1,
            byEcosystem: { npm: 1, pypi: 0, cargo: 0, go: 0, maven: 0 },
            byScope: { runtime: 1, dev: 0, build: 0, optional: 0, peer: 0 },
            outdatedCount: null,
            unusedCount: null,
            moduleCount: 1,
            crossEdgeCount: 0,
          },
        },
      });
    });

    // Module list should show the module
    expect(screen.getByText('api')).toBeInTheDocument();

    // Select module
    fireEvent.click(screen.getByTestId('module-packages/api'));

    // Dependency list should show express
    expect(screen.getByText('express')).toBeInTheDocument();
    expect(screen.getByText('4.18.0')).toBeInTheDocument();
  });
});
