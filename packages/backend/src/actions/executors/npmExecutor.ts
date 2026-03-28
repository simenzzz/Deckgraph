/**
 * Executor for npm/pnpm ecosystem package management.
 *
 * Detects whether the project uses pnpm or npm by checking for
 * lock file presence: pnpm-lock.yaml → pnpm, package-lock.json → npm.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
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

type PackageManager = 'pnpm' | 'npm';

/**
 * Detect whether the module uses pnpm or npm by checking for lock files.
 * Searches in the module directory first, then the project root.
 */
function detectPackageManager(ctx: ExecutorContext): PackageManager {
  const searchPaths = [ctx.cwd, ctx.projectRoot];

  for (const dir of searchPaths) {
    if (existsSync(path.join(dir, 'pnpm-lock.yaml'))) return 'pnpm';
  }
  for (const dir of searchPaths) {
    if (existsSync(path.join(dir, 'package-lock.json'))) return 'npm';
  }

  // Default to npm if no lock file found
  return 'npm';
}

/**
 * Map DependencyScope to CLI flags for install/add commands.
 */
function scopeFlag(pm: PackageManager, scope: string): string[] {
  switch (scope) {
    case 'dev':
      return pm === 'pnpm' ? ['--save-dev'] : ['--save-dev'];
    case 'optional':
      return pm === 'pnpm' ? ['--save-optional'] : ['--save-optional'];
    case 'peer':
      return pm === 'pnpm' ? ['--save-peer'] : ['--save-peer'];
    default:
      return [];
  }
}

function formatCommand(pm: PackageManager, args: readonly string[]): string {
  return `${pm} ${args.join(' ')}`;
}

async function runCommand(
  pm: PackageManager,
  args: readonly string[],
  cwd: string,
): Promise<{ success: boolean; stderr: string }> {
  try {
    await execa(pm, args, { cwd, timeout: SUBPROCESS_TIMEOUT_MS });
    return { success: true, stderr: '' };
  } catch (error: unknown) {
    const stderr =
      error !== null && typeof error === 'object' && 'stderr' in error
        ? String(error.stderr)
        : String(error);
    return { success: false, stderr };
  }
}

export function createNpmExecutor(): EcosystemExecutor {
  return {
    ecosystem: 'npm',

    async update(ctx: ExecutorContext, options: UpdateOptions): Promise<PackageActionResult> {
      const pm = detectPackageManager(ctx);
      const pkg = `${options.packageName}@${options.targetVersion}`;
      const args =
        pm === 'pnpm'
          ? ['add', pkg, ...scopeFlag(pm, options.scope)]
          : ['install', pkg, ...scopeFlag(pm, options.scope)];

      const command = formatCommand(pm, args);
      const { success, stderr } = await runCommand(pm, args, ctx.cwd);

      return {
        action: 'update',
        ecosystem: 'npm',
        packageName: options.packageName,
        modulePath: ctx.modulePath,
        status: success ? 'success' : 'failure',
        previousVersion: null, // Populated by caller from pre-action state
        newVersion: success ? options.targetVersion : null,
        error: success ? null : stderr,
        command,
      };
    },

    async install(ctx: ExecutorContext, options: InstallOptions): Promise<PackageActionResult> {
      const pm = detectPackageManager(ctx);
      const pkg = options.version
        ? `${options.packageName}@${options.version}`
        : options.packageName;
      const args =
        pm === 'pnpm'
          ? ['add', pkg, ...scopeFlag(pm, options.scope)]
          : ['install', pkg, ...scopeFlag(pm, options.scope)];

      const command = formatCommand(pm, args);
      const { success, stderr } = await runCommand(pm, args, ctx.cwd);

      return {
        action: 'install',
        ecosystem: 'npm',
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
      const pm = detectPackageManager(ctx);
      const args =
        pm === 'pnpm'
          ? ['remove', options.packageName]
          : ['uninstall', options.packageName];

      const command = formatCommand(pm, args);
      const { success, stderr } = await runCommand(pm, args, ctx.cwd);

      return {
        action: 'remove',
        ecosystem: 'npm',
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
