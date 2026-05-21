/**
 * Executor for Rust (cargo) ecosystem package management.
 *
 * Uses `cargo add` for install/update and `cargo remove` for removal.
 */

import type { PackageActionResult } from '@deckgraph/shared';
import type {
  EcosystemExecutor,
  ExecutorContext,
  InstallOptions,
  RemoveOptions,
  UpdateOptions,
} from '../types.js';
import { runCommand } from './runCommand.js';

function formatCommand(args: readonly string[]): string {
  return `cargo ${args.join(' ')}`;
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
      const { success, stderr } = await runCommand('cargo', args, ctx.cwd);

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
      const { success, stderr } = await runCommand('cargo', args, ctx.cwd);

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
      const { success, stderr } = await runCommand('cargo', args, ctx.cwd);

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
