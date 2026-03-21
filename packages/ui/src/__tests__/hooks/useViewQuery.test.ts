import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useViewQuery } from '@/hooks/useViewQuery';
import { useFilterStore } from '@/stores/filterStore';
import { useProjectStore } from '@/stores/projectStore';
import { useViewStore } from '@/stores/viewStore';
import type { WsClient } from '@/lib/wsClient';
import type { Project } from '@deckgraph/shared';

const mockProject: Project = {
  root: '/test',
  config: null,
  modules: [],
  crossEdges: [],
  lastScannedAt: '2024-01-01T00:00:00.000Z',
};

function createMockClient(): WsClient {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn(() => true),
    getStatus: vi.fn(() => 'connected' as const),
  };
}

describe('useViewQuery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useFilterStore.getState().resetFilters();
    useProjectStore.setState({ project: null, isScanning: false, lastProgress: null });
    useViewStore.setState({ result: null, isLoading: false, selectedModulePath: null, currentView: 'overview' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not send query when no project', () => {
    const client = createMockClient();
    renderHook(() => useViewQuery(client));
    expect(client.send).not.toHaveBeenCalled();
  });

  it('sends view_query when project exists', async () => {
    const client = createMockClient();
    useProjectStore.setState({ project: mockProject });

    renderHook(() => useViewQuery(client));

    // Wait for debounce
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(client.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'view_query' }),
    );
  });

  it('includes ecosystem filter in query', async () => {
    const client = createMockClient();
    useProjectStore.setState({ project: mockProject });
    useFilterStore.getState().toggleEcosystem('npm');

    renderHook(() => useViewQuery(client));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    const call = (client.send as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as Record<string, unknown>).type === 'view_query',
    );
    expect(call).toBeDefined();
    expect((call![0] as Record<string, unknown>).query).toMatchObject({
      ecosystems: ['npm'],
    });
  });

  it('does not send when client is null', () => {
    useProjectStore.setState({ project: mockProject });
    renderHook(() => useViewQuery(null));
    // Should not throw
  });
});
