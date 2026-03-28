import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePackageBatch } from '@/hooks/usePackageAction';
import { useActionStore } from '@/stores/actionStore';
import type { PackageBatchOperation } from '@deckgraph/shared';

function createMockWsClient() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn().mockReturnValue(true),
    getStatus: vi.fn().mockReturnValue('connected' as const),
  };
}

const mockOperations: PackageBatchOperation[] = [
  { action: 'update', ecosystem: 'npm', packageName: 'react', modulePath: 'packages/app', targetVersion: '19.0.0', scope: null },
  { action: 'remove', ecosystem: 'npm', packageName: 'lodash', modulePath: 'packages/app', targetVersion: null, scope: null },
];

describe('usePackageBatch', () => {
  beforeEach(() => {
    useActionStore.setState({
      inProgress: new Map(),
      lastResult: null,
      batchResults: [],
      isBatchRunning: false,
    });
  });

  it('returns isBatchRunning from store', () => {
    const { result } = renderHook(() => usePackageBatch(null));
    expect(result.current.isBatchRunning).toBe(false);

    act(() => useActionStore.getState().startBatch());
    expect(result.current.isBatchRunning).toBe(true);
  });

  it('returns batchResults from store', () => {
    const mockResult = {
      action: 'update' as const,
      ecosystem: 'npm' as const,
      packageName: 'react',
      modulePath: 'packages/app',
      status: 'success' as const,
      previousVersion: '18.0.0',
      newVersion: '19.0.0',
      error: null,
      command: 'pnpm add react@19.0.0',
    };

    const { result } = renderHook(() => usePackageBatch(null));
    act(() => useActionStore.getState().batchComplete([mockResult]));
    expect(result.current.batchResults).toHaveLength(1);
  });

  it('runBatch sends package_batch message and starts batch in store', () => {
    const ws = createMockWsClient();
    const { result } = renderHook(() => usePackageBatch(ws));

    act(() => result.current.runBatch(mockOperations));

    expect(ws.send).toHaveBeenCalledTimes(1);
    const sentMessage = ws.send.mock.calls[0]![0];
    expect(sentMessage.type).toBe('package_batch');
    expect(sentMessage.operations).toEqual(mockOperations);
    expect(useActionStore.getState().isBatchRunning).toBe(true);
  });

  it('runBatch does nothing with empty operations', () => {
    const ws = createMockWsClient();
    const { result } = renderHook(() => usePackageBatch(ws));

    act(() => result.current.runBatch([]));

    expect(ws.send).not.toHaveBeenCalled();
    expect(useActionStore.getState().isBatchRunning).toBe(false);
  });

  it('runBatch does nothing with null wsClient', () => {
    const { result } = renderHook(() => usePackageBatch(null));

    act(() => result.current.runBatch(mockOperations));

    expect(useActionStore.getState().isBatchRunning).toBe(false);
  });

  it('clearBatch resets store state', () => {
    const { result } = renderHook(() => usePackageBatch(null));

    act(() => useActionStore.getState().startBatch());
    expect(result.current.isBatchRunning).toBe(true);

    act(() => result.current.clearBatch());
    expect(result.current.isBatchRunning).toBe(false);
    expect(result.current.batchResults).toHaveLength(0);
  });
});
