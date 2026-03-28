/**
 * Batch executor for package management operations.
 *
 * Executes operations sequentially with fail-fast semantics:
 * stops on first failure/rollback and returns partial results.
 * Each operation acquires/releases its own per-module lock.
 */

import type {
  Module,
  PackageActionResult,
  PackageBatchOperation,
} from '@deckgraph/shared';
import { createLogger } from '../logger.js';
import { updatePackage, installPackage, removePackage } from './packageManager.js';
import type { PackageManagerDeps } from './packageManager.js';

const logger = createLogger('batchExecutor');

/**
 * Callback to look up a module by path from the current scan state.
 * Must return the latest state (after prior operations' incremental scans).
 */
export type FindModule = (modulePath: string) => Module | undefined;

/**
 * Callback to run incremental re-scan after a successful operation.
 * Responsible for updating the scan state so subsequent findModule
 * calls reflect the change.
 */
export type PostActionScan = (module: Module) => Promise<void>;

/**
 * Dependencies injected into the batch executor.
 * Keeps this module decoupled from ServerState and the scanner.
 */
export interface BatchContext {
  readonly findModule: FindModule;
  readonly moduleActionLocks: Map<string, string>;
  readonly postActionScan: PostActionScan;
}

export interface BatchExecutionResult {
  readonly results: readonly PackageActionResult[];
  readonly completedCount: number;
  readonly totalCount: number;
  readonly stoppedEarly: boolean;
}

/**
 * Emit progress for a batch operation step.
 */
export type BatchProgressEmitter = (
  requestId: string,
  message: string,
  phase: 0 | 1 | 2 | 3,
) => void;

const ACTION_LABELS: Record<string, string> = {
  update: 'Updating',
  install: 'Installing',
  remove: 'Removing',
};

/**
 * Execute a batch of package operations sequentially with fail-fast.
 *
 * For each operation:
 * 1. Resolve the target module
 * 2. Acquire per-module lock
 * 3. Dispatch to the appropriate packageManager function
 * 4. On success: run incremental scan, continue
 * 5. On failure/rolled-back: stop early, return partial results
 */
export async function executeBatch(
  deps: PackageManagerDeps,
  operations: readonly PackageBatchOperation[],
  ctx: BatchContext,
  emitProgress: BatchProgressEmitter,
  requestId: string,
): Promise<BatchExecutionResult> {
  const results: PackageActionResult[] = [];
  const total = operations.length;
  let stoppedEarly = false;

  for (let i = 0; i < total; i++) {
    const op = operations[i]!;
    const label = ACTION_LABELS[op.action] ?? op.action;
    emitProgress(requestId, `[${i + 1}/${total}] ${label} ${op.packageName} in ${op.modulePath}...`, 0);

    const module = ctx.findModule(op.modulePath);
    if (!module) {
      results.push(failResult(op, `Module not found: ${op.modulePath}`));
      stoppedEarly = true;
      break;
    }

    // Check per-module lock
    const existingLock = ctx.moduleActionLocks.get(op.modulePath);
    if (existingLock) {
      results.push(failResult(op, `A package operation is already in progress on "${module.name}"`));
      stoppedEarly = true;
      break;
    }

    ctx.moduleActionLocks.set(op.modulePath, requestId);
    try {
      const result = await dispatchAction(deps, module, op);
      results.push(result);

      if (result.status === 'failure' || result.status === 'rolled-back') {
        logger.warn(
          { action: op.action, packageName: op.packageName, status: result.status },
          'Batch stopping early due to failed operation',
        );
        stoppedEarly = true;
        break;
      }

      // Success — re-scan so subsequent operations see fresh state
      await ctx.postActionScan(module);
    } finally {
      ctx.moduleActionLocks.delete(op.modulePath);
    }
  }

  logger.info(
    { completed: results.length, total, stoppedEarly },
    'Batch execution complete',
  );

  return {
    results,
    completedCount: results.length,
    totalCount: total,
    stoppedEarly,
  };
}

/**
 * Dispatch a single batch operation to the appropriate packageManager function.
 */
async function dispatchAction(
  deps: PackageManagerDeps,
  module: Module,
  op: PackageBatchOperation,
): Promise<PackageActionResult> {
  switch (op.action) {
    case 'update':
      if (!op.targetVersion) {
        return failResult(op, 'targetVersion is required for update operations');
      }
      return updatePackage(deps, module, op.packageName, op.targetVersion);

    case 'install':
      return installPackage(
        deps,
        module,
        op.packageName,
        op.ecosystem,
        op.targetVersion,
        op.scope ?? 'runtime',
      );

    case 'remove':
      return removePackage(deps, module, op.packageName);

    default: {
      const _exhaustive: never = op.action;
      return _exhaustive;
    }
  }
}

function failResult(
  op: PackageBatchOperation,
  error: string,
): PackageActionResult {
  return {
    action: op.action,
    ecosystem: op.ecosystem,
    packageName: op.packageName,
    modulePath: op.modulePath,
    status: 'failure',
    previousVersion: null,
    newVersion: null,
    error,
    command: '',
  };
}
