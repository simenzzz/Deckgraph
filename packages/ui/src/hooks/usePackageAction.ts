/**
 * Hook for triggering package management actions.
 *
 * Sends update/install/remove messages over WebSocket and tracks
 * their progress via actionStore.
 */

import { useCallback, useMemo } from 'react';
import type { Dependency, DependencyScope, Ecosystem, PackageActionResult, PackageBatchOperation } from '@deckgraph/shared';
import { useActionStore } from '@/stores/actionStore';
import type { WsClient } from '@/lib/wsClient';
import { createRequestId } from '@/lib/wsClient';

export interface PackageUpdateAction {
  /** Whether an update is currently in progress for this module */
  readonly isUpdating: boolean;
  /** Most recent result (null until first action completes) */
  readonly lastResult: PackageActionResult | null;
  /** Trigger an update to a specific version */
  readonly updateTo: (version: string) => void;
  /** Clear the last result */
  readonly clearResult: () => void;
}

export function usePackageUpdate(
  dep: Dependency | null,
  modulePath: string | null,
  wsClient: WsClient | null,
): PackageUpdateAction {
  const inProgress = useActionStore((s) => s.inProgress);
  const lastResult = useActionStore((s) => s.lastResult);

  const isUpdating = useMemo(() => {
    if (!modulePath) return false;
    return inProgress.has(modulePath);
  }, [modulePath, inProgress]);

  const updateTo = useCallback(
    (version: string) => {
      if (!dep || !modulePath || !wsClient) return;
      const requestId = createRequestId();
      useActionStore.getState().startAction(modulePath, requestId);
      wsClient.send({
        type: 'package_update',
        requestId,
        ecosystem: dep.ecosystem,
        packageName: dep.name,
        modulePath,
        targetVersion: version,
      });
    },
    [dep, modulePath, wsClient],
  );

  const clearResult = useCallback(() => {
    useActionStore.getState().clearResult();
  }, []);

  return { isUpdating, lastResult, updateTo, clearResult };
}

export interface PackageRemoveAction {
  readonly isRemoving: boolean;
  readonly lastResult: PackageActionResult | null;
  readonly remove: () => void;
  readonly clearResult: () => void;
}

export function usePackageRemove(
  dep: Dependency | null,
  modulePath: string | null,
  wsClient: WsClient | null,
): PackageRemoveAction {
  const inProgress = useActionStore((s) => s.inProgress);
  const lastResult = useActionStore((s) => s.lastResult);

  const isRemoving = useMemo(() => {
    if (!modulePath) return false;
    return inProgress.has(modulePath);
  }, [modulePath, inProgress]);

  const remove = useCallback(() => {
    if (!dep || !modulePath || !wsClient) return;
    const requestId = createRequestId();
    useActionStore.getState().startAction(modulePath, requestId);
    wsClient.send({
      type: 'package_remove',
      requestId,
      ecosystem: dep.ecosystem,
      packageName: dep.name,
      modulePath,
    });
  }, [dep, modulePath, wsClient]);

  const clearResult = useCallback(() => {
    useActionStore.getState().clearResult();
  }, []);

  return { isRemoving, lastResult, remove, clearResult };
}

export interface PackageInstallAction {
  readonly isInstalling: boolean;
  readonly lastResult: PackageActionResult | null;
  readonly install: (packageName: string, ecosystem: Ecosystem, version: string | null, scope: DependencyScope) => void;
  readonly clearResult: () => void;
}

export function usePackageInstall(
  modulePath: string | null,
  wsClient: WsClient | null,
): PackageInstallAction {
  const inProgress = useActionStore((s) => s.inProgress);
  const lastResult = useActionStore((s) => s.lastResult);

  const isInstalling = useMemo(() => {
    if (!modulePath) return false;
    return inProgress.has(modulePath);
  }, [modulePath, inProgress]);

  const install = useCallback(
    (packageName: string, ecosystem: Ecosystem, version: string | null, scope: DependencyScope) => {
      if (!modulePath || !wsClient) return;
      const requestId = createRequestId();
      useActionStore.getState().startAction(modulePath, requestId);
      wsClient.send({
        type: 'package_install',
        requestId,
        ecosystem,
        packageName,
        modulePath,
        version,
        scope,
      });
    },
    [modulePath, wsClient],
  );

  const clearResult = useCallback(() => {
    useActionStore.getState().clearResult();
  }, []);

  return { isInstalling, lastResult, install, clearResult };
}

export interface PackageBatchAction {
  /** Whether a batch operation is currently running */
  readonly isBatchRunning: boolean;
  /** Results from the last batch operation */
  readonly batchResults: readonly PackageActionResult[];
  /** Execute a batch of operations */
  readonly runBatch: (operations: readonly PackageBatchOperation[]) => void;
  /** Clear batch results */
  readonly clearBatch: () => void;
}

export function usePackageBatch(
  wsClient: WsClient | null,
): PackageBatchAction {
  const isBatchRunning = useActionStore((s) => s.isBatchRunning);
  const batchResults = useActionStore((s) => s.batchResults);

  const runBatch = useCallback(
    (operations: readonly PackageBatchOperation[]) => {
      if (!wsClient || operations.length === 0) return;
      const requestId = createRequestId();
      useActionStore.getState().startBatch();
      wsClient.send({
        type: 'package_batch',
        requestId,
        operations,
      });
    },
    [wsClient],
  );

  const clearBatch = useCallback(() => {
    useActionStore.getState().clearBatch();
  }, []);

  return { isBatchRunning, batchResults, runBatch, clearBatch };
}
