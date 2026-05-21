/**
 * Executor for npm/pnpm ecosystem package management.
 *
 * Detects whether the project uses pnpm or npm by checking for
 * lock file presence: pnpm-lock.yaml → pnpm, package-lock.json → npm.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';

import type { PackageActionResult } from '@deckgraph/shared';
import type {
  EcosystemExecutor,
  ExecutorContext,
  InstallOptions,
  RemoveOptions,
  UpdateOptions,
} from '../types.js';
import { runCommand } from './runCommand.js';

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
function scopeFlag(scope: string): string[] {
  switch (scope) {
    case 'dev':
      return ['--save-dev'];
    case 'optional':
      return ['--save-optional'];
    case 'peer':
      return ['--save-peer'];
    default:
      return [];
  }
}

function formatCommand(pm: PackageManager, args: readonly string[]): string {
  return `${pm} ${args.join(' ')}`;
}

export function createNpmExecutor(): EcosystemExecutor {
  return {
    ecosystem: 'npm',

    async update(ctx: ExecutorContext, options: UpdateOptions): Promise<PackageActionResult> {
      const pm = detectPackageManager(ctx);
      const pkg = `${options.packageName}@${options.targetVersion}`;
      const args =
        pm === 'pnpm'
          ? ['add', pkg, ...scopeFlag(options.scope)]
          : ['install', pkg, ...scopeFlag(options.scope)];

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
          ? ['add', pkg, ...scopeFlag(options.scope)]
          : ['install', pkg, ...scopeFlag(options.scope)];

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
