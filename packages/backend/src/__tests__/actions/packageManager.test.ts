import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Module, PackageActionResult } from '@deckgraph/shared';
import { updatePackage, installPackage, removePackage } from '../../actions/packageManager.js';
import type { EcosystemExecutor, ExecutorRegistry } from '../../actions/types.js';

// Mock manifestBackup to avoid filesystem access
vi.mock('../../actions/manifestBackup.js', () => ({
  backupManifests: vi.fn(() => ({ files: new Map() })),
  restoreManifests: vi.fn(),
}));

import { restoreManifests } from '../../actions/manifestBackup.js';

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
  ],
  analysisState: 'manifest-only',
};

function createMockExecutor(overrides: Partial<EcosystemExecutor> = {}): EcosystemExecutor {
  return {
    ecosystem: 'npm',
    update: vi.fn<[], Promise<PackageActionResult>>().mockResolvedValue({
      action: 'update',
      ecosystem: 'npm',
      packageName: 'react',
      modulePath: 'packages/app',
      status: 'success',
      previousVersion: null,
      newVersion: '19.0.0',
      error: null,
      command: 'pnpm add react@19.0.0',
    }),
    install: vi.fn<[], Promise<PackageActionResult>>().mockResolvedValue({
      action: 'install',
      ecosystem: 'npm',
      packageName: 'lodash',
      modulePath: 'packages/app',
      status: 'success',
      previousVersion: null,
      newVersion: '4.17.21',
      error: null,
      command: 'pnpm add lodash@4.17.21',
    }),
    remove: vi.fn<[], Promise<PackageActionResult>>().mockResolvedValue({
      action: 'remove',
      ecosystem: 'npm',
      packageName: 'react',
      modulePath: 'packages/app',
      status: 'success',
      previousVersion: null,
      newVersion: null,
      error: null,
      command: 'pnpm remove react',
    }),
    ...overrides,
  };
}

function createDeps(executor: EcosystemExecutor) {
  const executorRegistry: ExecutorRegistry = new Map([['npm', executor]]);
  return { executorRegistry, projectRoot: '/test' };
}

describe('updatePackage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls executor and returns result with previousVersion', async () => {
    const executor = createMockExecutor();
    const result = await updatePackage(createDeps(executor), mockModule, 'react', '19.0.0');
    expect(result.status).toBe('success');
    expect(result.previousVersion).toBe('18.0.0');
    expect(executor.update).toHaveBeenCalled();
  });

  it('rolls back on failure', async () => {
    const executor = createMockExecutor({
      update: vi.fn().mockResolvedValue({
        action: 'update',
        ecosystem: 'npm',
        packageName: 'react',
        modulePath: 'packages/app',
        status: 'failure',
        previousVersion: null,
        newVersion: null,
        error: 'Network error',
        command: 'pnpm add react@19.0.0',
      }),
    });

    const result = await updatePackage(createDeps(executor), mockModule, 'react', '19.0.0');
    expect(result.status).toBe('rolled-back');
    expect(restoreManifests).toHaveBeenCalled();
  });

  it('fails validation for missing package', async () => {
    const executor = createMockExecutor();
    const result = await updatePackage(createDeps(executor), mockModule, 'nonexistent', '1.0.0');
    expect(result.status).toBe('failure');
    expect(result.error).toContain('not found');
    expect(executor.update).not.toHaveBeenCalled();
  });

  it('fails when no executor for ecosystem', async () => {
    const pyModule: Module = { ...mockModule, ecosystem: 'pypi' };
    const executor = createMockExecutor();
    const result = await updatePackage(createDeps(executor), pyModule, 'react', '19.0.0');
    expect(result.status).toBe('failure');
    expect(result.error).toContain('No executor');
  });
});

describe('installPackage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls executor for install', async () => {
    const executor = createMockExecutor();
    const result = await installPackage(
      createDeps(executor),
      mockModule,
      'lodash',
      'npm',
      '4.17.21',
      'runtime',
    );
    expect(result.status).toBe('success');
    expect(executor.install).toHaveBeenCalled();
  });

  it('rejects installing already-installed package', async () => {
    const executor = createMockExecutor();
    const result = await installPackage(
      createDeps(executor),
      mockModule,
      'react',
      'npm',
      '18.0.0',
      'runtime',
    );
    expect(result.status).toBe('failure');
    expect(result.error).toContain('already installed');
  });
});

describe('path traversal', () => {
  it('rejects module paths that escape project root', async () => {
    const traversalModule: Module = {
      ...mockModule,
      path: '../../etc',
    };
    const executor = createMockExecutor();
    await expect(
      updatePackage(createDeps(executor), traversalModule, 'react', '19.0.0'),
    ).rejects.toThrow('Path traversal detected');
  });
});

describe('removePackage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls executor for remove', async () => {
    const executor = createMockExecutor();
    const result = await removePackage(createDeps(executor), mockModule, 'react');
    expect(result.status).toBe('success');
    expect(result.previousVersion).toBe('18.0.0');
  });

  it('fails for package not in module', async () => {
    const executor = createMockExecutor();
    const result = await removePackage(createDeps(executor), mockModule, 'nonexistent');
    expect(result.status).toBe('failure');
    expect(result.error).toContain('not found');
  });
});
