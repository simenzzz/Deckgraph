import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';

// Mock execa before importing the module
vi.mock('execa', () => ({
  execa: vi.fn(),
}));

import { execa } from 'execa';
import { createNpmExecutor } from '../../../actions/executors/npmExecutor.js';
import type { ExecutorContext } from '../../../actions/types.js';

const mockedExeca = vi.mocked(execa);

describe('npmExecutor', () => {
  let tempDir: string;
  let ctx: ExecutorContext;
  const executor = createNpmExecutor();

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'deckgraph-npm-test-'));
    ctx = {
      projectRoot: tempDir,
      modulePath: '.',
      cwd: tempDir,
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('update', () => {
    it('uses pnpm add when pnpm-lock.yaml exists', async () => {
      writeFileSync(path.join(tempDir, 'pnpm-lock.yaml'), '');
      mockedExeca.mockResolvedValue({} as never);

      const result = await executor.update(ctx, {
        packageName: 'react',
        targetVersion: '19.0.0',
        scope: 'runtime',
      });

      expect(result.status).toBe('success');
      expect(result.command).toContain('pnpm add react@19.0.0');
      expect(mockedExeca).toHaveBeenCalledWith(
        'pnpm',
        ['add', 'react@19.0.0'],
        expect.objectContaining({ cwd: tempDir }),
      );
    });

    it('uses npm install when package-lock.json exists', async () => {
      writeFileSync(path.join(tempDir, 'package-lock.json'), '{}');
      mockedExeca.mockResolvedValue({} as never);

      const result = await executor.update(ctx, {
        packageName: 'react',
        targetVersion: '19.0.0',
        scope: 'runtime',
      });

      expect(result.status).toBe('success');
      expect(result.command).toContain('npm install react@19.0.0');
    });

    it('adds --save-dev for dev scope', async () => {
      writeFileSync(path.join(tempDir, 'pnpm-lock.yaml'), '');
      mockedExeca.mockResolvedValue({} as never);

      await executor.update(ctx, {
        packageName: 'vitest',
        targetVersion: '3.0.0',
        scope: 'dev',
      });

      expect(mockedExeca).toHaveBeenCalledWith(
        'pnpm',
        ['add', 'vitest@3.0.0', '--save-dev'],
        expect.any(Object),
      );
    });

    it('returns failure on non-zero exit', async () => {
      writeFileSync(path.join(tempDir, 'pnpm-lock.yaml'), '');
      mockedExeca.mockRejectedValue({ stderr: 'Package not found' });

      const result = await executor.update(ctx, {
        packageName: 'nonexistent',
        targetVersion: '1.0.0',
        scope: 'runtime',
      });

      expect(result.status).toBe('failure');
      expect(result.error).toContain('Package not found');
    });
  });

  describe('install', () => {
    it('installs with specific version', async () => {
      writeFileSync(path.join(tempDir, 'pnpm-lock.yaml'), '');
      mockedExeca.mockResolvedValue({} as never);

      const result = await executor.install(ctx, {
        packageName: 'lodash',
        version: '4.17.21',
        scope: 'runtime',
      });

      expect(result.status).toBe('success');
      expect(result.command).toContain('lodash@4.17.21');
    });

    it('installs latest when version is null', async () => {
      writeFileSync(path.join(tempDir, 'pnpm-lock.yaml'), '');
      mockedExeca.mockResolvedValue({} as never);

      const result = await executor.install(ctx, {
        packageName: 'lodash',
        version: null,
        scope: 'runtime',
      });

      expect(result.status).toBe('success');
      expect(result.command).toContain('pnpm add lodash');
      expect(result.command).not.toContain('@');
    });
  });

  describe('remove', () => {
    it('uses pnpm remove', async () => {
      writeFileSync(path.join(tempDir, 'pnpm-lock.yaml'), '');
      mockedExeca.mockResolvedValue({} as never);

      const result = await executor.remove(ctx, { packageName: 'react' });

      expect(result.status).toBe('success');
      expect(result.command).toContain('pnpm remove react');
    });

    it('uses npm uninstall when npm is detected', async () => {
      writeFileSync(path.join(tempDir, 'package-lock.json'), '{}');
      mockedExeca.mockResolvedValue({} as never);

      const result = await executor.remove(ctx, { packageName: 'react' });

      expect(result.command).toContain('npm uninstall react');
    });
  });
});
