import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Module, PackageActionResult, PackageBatchOperation } from '@deckgraph/shared';
import { executeBatch } from '../../actions/batchExecutor.js';
import type { BatchContext, BatchProgressEmitter } from '../../actions/batchExecutor.js';
import type { PackageManagerDeps } from '../../actions/packageManager.js';

// Mock packageManager functions
vi.mock('../../actions/packageManager.js', () => ({
  updatePackage: vi.fn(),
  installPackage: vi.fn(),
  removePackage: vi.fn(),
}));

import { updatePackage, installPackage, removePackage } from '../../actions/packageManager.js';

const mockUpdatePackage = vi.mocked(updatePackage);
const mockInstallPackage = vi.mocked(installPackage);
const mockRemovePackage = vi.mocked(removePackage);

const mockModule: Module = {
  path: 'packages/app',
  name: 'app',
  ecosystem: 'npm',
  manifests: ['package.json'],
  dependencies: [
    {
      name: 'react',
      ecosystem: 'npm',
      version: '18.0.0',
      constraint: '^18',
      scope: 'runtime',
      source: 'manifest',
      concerns: [],
      usedInFiles: null,
      transitiveDeps: null,
      registryMeta: null,
    },
    {
      name: 'lodash',
      ecosystem: 'npm',
      version: '4.17.20',
      constraint: '^4',
      scope: 'runtime',
      source: 'manifest',
      concerns: [],
      usedInFiles: null,
      transitiveDeps: null,
      registryMeta: null,
    },
  ],
  analysisState: 'manifest-only',
};

function successResult(op: PackageBatchOperation): PackageActionResult {
  return {
    action: op.action,
    ecosystem: op.ecosystem,
    packageName: op.packageName,
    modulePath: op.modulePath,
    status: 'success',
    previousVersion: '1.0.0',
    newVersion: op.targetVersion ?? '2.0.0',
    error: null,
    command: `pnpm ${op.action} ${op.packageName}`,
  };
}

function failureResult(op: PackageBatchOperation, error: string): PackageActionResult {
  return {
    action: op.action,
    ecosystem: op.ecosystem,
    packageName: op.packageName,
    modulePath: op.modulePath,
    status: 'failure',
    previousVersion: null,
    newVersion: null,
    error,
    command: `pnpm ${op.action} ${op.packageName}`,
  };
}

function createContext(overrides: Partial<BatchContext> = {}): BatchContext {
  return {
    findModule: vi.fn((path: string) => (path === 'packages/app' ? mockModule : undefined)),
    moduleActionLocks: new Map(),
    postActionScan: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const mockDeps: PackageManagerDeps = {
  executorRegistry: new Map(),
  projectRoot: '/test',
};

const mockEmitProgress: BatchProgressEmitter = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

describe('executeBatch', () => {
  it('executes all operations on success', async () => {
    const ops: PackageBatchOperation[] = [
      { action: 'update', ecosystem: 'npm', packageName: 'react', modulePath: 'packages/app', targetVersion: '19.0.0', scope: null },
      { action: 'update', ecosystem: 'npm', packageName: 'lodash', modulePath: 'packages/app', targetVersion: '4.17.21', scope: null },
    ];

    mockUpdatePackage
      .mockResolvedValueOnce(successResult(ops[0]!))
      .mockResolvedValueOnce(successResult(ops[1]!));

    const ctx = createContext();
    const result = await executeBatch(mockDeps, ops, ctx, mockEmitProgress, 'req-1');

    expect(result.completedCount).toBe(2);
    expect(result.totalCount).toBe(2);
    expect(result.stoppedEarly).toBe(false);
    expect(result.results).toHaveLength(2);
    expect(result.results[0]!.status).toBe('success');
    expect(result.results[1]!.status).toBe('success');
  });

  it('stops early on failure (fail-fast)', async () => {
    const ops: PackageBatchOperation[] = [
      { action: 'update', ecosystem: 'npm', packageName: 'react', modulePath: 'packages/app', targetVersion: '19.0.0', scope: null },
      { action: 'update', ecosystem: 'npm', packageName: 'lodash', modulePath: 'packages/app', targetVersion: '4.17.21', scope: null },
      { action: 'update', ecosystem: 'npm', packageName: 'zod', modulePath: 'packages/app', targetVersion: '3.0.0', scope: null },
    ];

    mockUpdatePackage
      .mockResolvedValueOnce(successResult(ops[0]!))
      .mockResolvedValueOnce(failureResult(ops[1]!, 'version not found'));

    const ctx = createContext();
    const result = await executeBatch(mockDeps, ops, ctx, mockEmitProgress, 'req-1');

    expect(result.completedCount).toBe(2);
    expect(result.totalCount).toBe(3);
    expect(result.stoppedEarly).toBe(true);
    expect(result.results[0]!.status).toBe('success');
    expect(result.results[1]!.status).toBe('failure');
    // Third operation was never attempted
    expect(mockUpdatePackage).toHaveBeenCalledTimes(2);
  });

  it('stops early on rolled-back status', async () => {
    const ops: PackageBatchOperation[] = [
      { action: 'update', ecosystem: 'npm', packageName: 'react', modulePath: 'packages/app', targetVersion: '19.0.0', scope: null },
    ];

    mockUpdatePackage.mockResolvedValueOnce({
      ...successResult(ops[0]!),
      status: 'rolled-back',
      error: 'subprocess failed',
    });

    const ctx = createContext();
    const result = await executeBatch(mockDeps, ops, ctx, mockEmitProgress, 'req-1');

    expect(result.completedCount).toBe(1);
    expect(result.stoppedEarly).toBe(true);
  });

  it('fails when module is not found', async () => {
    const ops: PackageBatchOperation[] = [
      { action: 'update', ecosystem: 'npm', packageName: 'react', modulePath: 'packages/missing', targetVersion: '19.0.0', scope: null },
    ];

    const ctx = createContext();
    const result = await executeBatch(mockDeps, ops, ctx, mockEmitProgress, 'req-1');

    expect(result.completedCount).toBe(1);
    expect(result.stoppedEarly).toBe(true);
    expect(result.results[0]!.status).toBe('failure');
    expect(result.results[0]!.error).toContain('Module not found');
  });

  it('fails when module is locked', async () => {
    const ops: PackageBatchOperation[] = [
      { action: 'update', ecosystem: 'npm', packageName: 'react', modulePath: 'packages/app', targetVersion: '19.0.0', scope: null },
    ];

    const locks = new Map([['packages/app', 'other-req']]);
    const ctx = createContext({ moduleActionLocks: locks });
    const result = await executeBatch(mockDeps, ops, ctx, mockEmitProgress, 'req-1');

    expect(result.completedCount).toBe(1);
    expect(result.stoppedEarly).toBe(true);
    expect(result.results[0]!.status).toBe('failure');
    expect(result.results[0]!.error).toContain('already in progress');
  });

  it('dispatches to correct packageManager function for mixed actions', async () => {
    const ops: PackageBatchOperation[] = [
      { action: 'update', ecosystem: 'npm', packageName: 'react', modulePath: 'packages/app', targetVersion: '19.0.0', scope: null },
      { action: 'install', ecosystem: 'npm', packageName: 'axios', modulePath: 'packages/app', targetVersion: '1.0.0', scope: 'runtime' },
      { action: 'remove', ecosystem: 'npm', packageName: 'lodash', modulePath: 'packages/app', targetVersion: null, scope: null },
    ];

    mockUpdatePackage.mockResolvedValueOnce(successResult(ops[0]!));
    mockInstallPackage.mockResolvedValueOnce(successResult(ops[1]!));
    mockRemovePackage.mockResolvedValueOnce(successResult(ops[2]!));

    const ctx = createContext();
    const result = await executeBatch(mockDeps, ops, ctx, mockEmitProgress, 'req-1');

    expect(result.completedCount).toBe(3);
    expect(result.stoppedEarly).toBe(false);
    expect(mockUpdatePackage).toHaveBeenCalledTimes(1);
    expect(mockInstallPackage).toHaveBeenCalledTimes(1);
    expect(mockRemovePackage).toHaveBeenCalledTimes(1);
  });

  it('emits progress for each operation', async () => {
    const ops: PackageBatchOperation[] = [
      { action: 'update', ecosystem: 'npm', packageName: 'react', modulePath: 'packages/app', targetVersion: '19.0.0', scope: null },
      { action: 'remove', ecosystem: 'npm', packageName: 'lodash', modulePath: 'packages/app', targetVersion: null, scope: null },
    ];

    mockUpdatePackage.mockResolvedValueOnce(successResult(ops[0]!));
    mockRemovePackage.mockResolvedValueOnce(successResult(ops[1]!));

    const ctx = createContext();
    await executeBatch(mockDeps, ops, ctx, mockEmitProgress, 'req-1');

    expect(mockEmitProgress).toHaveBeenCalledWith('req-1', expect.stringContaining('[1/2]'), 0);
    expect(mockEmitProgress).toHaveBeenCalledWith('req-1', expect.stringContaining('[2/2]'), 0);
  });

  it('runs postActionScan after each successful operation', async () => {
    const ops: PackageBatchOperation[] = [
      { action: 'update', ecosystem: 'npm', packageName: 'react', modulePath: 'packages/app', targetVersion: '19.0.0', scope: null },
      { action: 'update', ecosystem: 'npm', packageName: 'lodash', modulePath: 'packages/app', targetVersion: '4.17.21', scope: null },
    ];

    mockUpdatePackage
      .mockResolvedValueOnce(successResult(ops[0]!))
      .mockResolvedValueOnce(successResult(ops[1]!));

    const ctx = createContext();
    await executeBatch(mockDeps, ops, ctx, mockEmitProgress, 'req-1');

    expect(ctx.postActionScan).toHaveBeenCalledTimes(2);
  });

  it('does not run postActionScan after failed operation', async () => {
    const ops: PackageBatchOperation[] = [
      { action: 'update', ecosystem: 'npm', packageName: 'react', modulePath: 'packages/app', targetVersion: '19.0.0', scope: null },
    ];

    mockUpdatePackage.mockResolvedValueOnce(failureResult(ops[0]!, 'error'));

    const ctx = createContext();
    await executeBatch(mockDeps, ops, ctx, mockEmitProgress, 'req-1');

    expect(ctx.postActionScan).not.toHaveBeenCalled();
  });

  it('releases module lock after each operation', async () => {
    const ops: PackageBatchOperation[] = [
      { action: 'update', ecosystem: 'npm', packageName: 'react', modulePath: 'packages/app', targetVersion: '19.0.0', scope: null },
    ];

    mockUpdatePackage.mockResolvedValueOnce(successResult(ops[0]!));

    const locks = new Map<string, string>();
    const ctx = createContext({ moduleActionLocks: locks });
    await executeBatch(mockDeps, ops, ctx, mockEmitProgress, 'req-1');

    // Lock should be released after completion
    expect(locks.has('packages/app')).toBe(false);
  });

  it('returns empty results for empty operations', async () => {
    const ctx = createContext();
    const result = await executeBatch(mockDeps, [], ctx, mockEmitProgress, 'req-1');

    expect(result.completedCount).toBe(0);
    expect(result.totalCount).toBe(0);
    expect(result.stoppedEarly).toBe(false);
    expect(result.results).toHaveLength(0);
  });
});
