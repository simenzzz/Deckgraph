import { describe, it, expect, beforeEach } from 'vitest';
import { useActionStore } from '@/stores/actionStore';
import type { PackageActionResult } from '@deckgraph/shared';

const successResult: PackageActionResult = {
  action: 'update',
  ecosystem: 'npm',
  packageName: 'react',
  modulePath: 'packages/app',
  status: 'success',
  previousVersion: '18.0.0',
  newVersion: '19.0.0',
  error: null,
  command: 'pnpm add react@19.0.0',
};

const failureResult: PackageActionResult = {
  action: 'update',
  ecosystem: 'npm',
  packageName: 'react',
  modulePath: 'packages/app',
  status: 'failure',
  previousVersion: '18.0.0',
  newVersion: null,
  error: 'Network error',
  command: 'pnpm add react@19.0.0',
};

describe('actionStore', () => {
  beforeEach(() => {
    useActionStore.setState({
      inProgress: new Map(),
      lastResult: null,
      batchResults: [],
      isBatchRunning: false,
    });
  });

  it('starts an action and tracks it by module path', () => {
    useActionStore.getState().startAction('packages/app', 'req-1');
    const state = useActionStore.getState();
    expect(state.inProgress.has('packages/app')).toBe(true);
    expect(state.inProgress.get('packages/app')).toBe('req-1');
    expect(state.lastResult).toBeNull();
  });

  it('completes an action and removes from inProgress', () => {
    useActionStore.getState().startAction('packages/app', 'req-1');
    useActionStore.getState().completeAction(successResult);

    const state = useActionStore.getState();
    expect(state.inProgress.has('packages/app')).toBe(false);
    expect(state.lastResult).toEqual(successResult);
  });

  it('clears last result', () => {
    useActionStore.getState().completeAction(successResult);
    useActionStore.getState().clearResult();
    expect(useActionStore.getState().lastResult).toBeNull();
  });

  it('handles failure result', () => {
    useActionStore.getState().startAction('packages/app', 'req-1');
    useActionStore.getState().completeAction(failureResult);

    const state = useActionStore.getState();
    expect(state.lastResult?.status).toBe('failure');
    expect(state.inProgress.size).toBe(0);
  });

  it('tracks multiple concurrent actions on different modules', () => {
    useActionStore.getState().startAction('packages/app', 'req-1');
    useActionStore.getState().startAction('packages/lib', 'req-2');
    expect(useActionStore.getState().inProgress.size).toBe(2);

    useActionStore.getState().completeAction(successResult);
    expect(useActionStore.getState().inProgress.size).toBe(1);
    expect(useActionStore.getState().inProgress.has('packages/lib')).toBe(true);
  });

  it('starts and completes a batch operation', () => {
    useActionStore.getState().startBatch();
    expect(useActionStore.getState().isBatchRunning).toBe(true);

    useActionStore.getState().batchComplete([successResult, failureResult]);
    const state = useActionStore.getState();
    expect(state.isBatchRunning).toBe(false);
    expect(state.batchResults).toHaveLength(2);
  });

  it('clears batch state', () => {
    useActionStore.getState().batchComplete([successResult]);
    useActionStore.getState().clearBatch();
    const state = useActionStore.getState();
    expect(state.batchResults).toHaveLength(0);
    expect(state.isBatchRunning).toBe(false);
  });

  it('resets all action state', () => {
    useActionStore.getState().startAction('packages/app', 'req-1');
    useActionStore.getState().completeAction(successResult);
    useActionStore.getState().startBatch();

    useActionStore.getState().reset();

    const state = useActionStore.getState();
    expect(state.inProgress.size).toBe(0);
    expect(state.lastResult).toBeNull();
    expect(state.batchResults).toEqual([]);
    expect(state.isBatchRunning).toBe(false);
  });
});
