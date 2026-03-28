/**
 * Executor for Rust (cargo) ecosystem package management.
 *
 * Uses `cargo add` for install/update and `cargo remove` for removal.
 */

import { execa } from 'execa';

import type { PackageActionResult } from '@deckgraph/shared';
import type {
  EcosystemExecutor,
  ExecutorContext,
  InstallOptions,
  RemoveOptions,
  UpdateOptions,
} from '../types.js';

const SUBPROCESS_TIMEOUT_MS = 60_000;

function formatCommand(args: readonly string[]): string {
  return `cargo ${args.join(' ')}`;
}

async function runCommand(
  args: readonly string[],
  cwd: string,
): Promise<{ success: boolean; stderr: string }> {
  try {
    await execa('cargo', args, { cwd, timeout: SUBPROCESS_TIMEOUT_MS });
    return { success: true, stderr: '' };
  } catch (error: unknown) {
    const stderr =
      error !== null && typeof error === 'object' && 'stderr' in error
        ? String(error.stderr)
        : String(error);
    return { success: false, stderr };
  }
}

function scopeFlag(scope: string): string[] {
  switch (scope) {
    case 'dev':
      return ['--dev'];
    case 'build':
      return ['--build'];
    default:
      return [];
  }
}

export function createCargoExecutor(): EcosystemExecutor {
  return {
    ecosystem: 'cargo',

    async update(ctx: ExecutorContext, options: UpdateOptions): Promise<PackageActionResult> {
      const args = [
        'add',
        `${options.packageName}@${options.targetVersion}`,
        ...scopeFlag(options.scope),
      ];
      const command = formatCommand(args);
      const { success, stderr } = await runCommand(args, ctx.cwd);

      return {
        action: 'update',
        ecosystem: 'cargo',
        packageName: options.packageName,
        modulePath: ctx.modulePath,
        status: success ? 'success' : 'failure',
        previousVersion: null,
        newVersion: success ? options.targetVersion : null,
        error: success ? null : stderr,
        command,
      };
    },

    async install(ctx: ExecutorContext, options: InstallOptions): Promise<PackageActionResult> {
      const pkg = options.version
        ? `${options.packageName}@${options.version}`
        : options.packageName;
      const args = ['add', pkg, ...scopeFlag(options.scope)];
      const command = formatCommand(args);
      const { success, stderr } = await runCommand(args, ctx.cwd);

      return {
        action: 'install',
        ecosystem: 'cargo',
        packageName: options.packageName,
        modulePath: ctx.modulePath,
        status: success ? 'success' : 'failure',
        previousVersion: null,
        newVersion: options.version,
        error: success ? null : stderr,
        command,
      };
    },

    async remove(ctx: ExecutorContext, options: RemoveOptions): Promise<PackageActionResult> {
      const args = ['remove', options.packageName];
      const command = formatCommand(args);
      const { success, stderr } = await runCommand(args, ctx.cwd);

      return {
        action: 'remove',
        ecosystem: 'cargo',
        packageName: options.packageName,
        modulePath: ctx.modulePath,
        status: success ? 'success' : 'failure',
        previousVersion: null,
        newVersion: null,
        error: success ? null : stderr,
        command,
      };
    },
  };
}
