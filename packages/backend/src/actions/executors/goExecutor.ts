/**
 * Executor for Go ecosystem package management.
 *
 * Uses `go get` for install/update and `go mod edit -droprequire` + `go mod tidy`
 * for removal.
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
  return `go ${args.join(' ')}`;
}

async function runCommand(
  args: readonly string[],
  cwd: string,
): Promise<{ success: boolean; stderr: string }> {
  try {
    await execa('go', args, { cwd, timeout: SUBPROCESS_TIMEOUT_MS });
    return { success: true, stderr: '' };
  } catch (error: unknown) {
    const stderr =
      error !== null && typeof error === 'object' && 'stderr' in error
        ? String(error.stderr)
        : String(error);
    return { success: false, stderr };
  }
}

export function createGoExecutor(): EcosystemExecutor {
  return {
    ecosystem: 'go',

    async update(ctx: ExecutorContext, options: UpdateOptions): Promise<PackageActionResult> {
      const args = ['get', `${options.packageName}@v${options.targetVersion}`];
      const command = formatCommand(args);
      const { success, stderr } = await runCommand(args, ctx.cwd);

      return {
        action: 'update',
        ecosystem: 'go',
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
      const version = options.version ? `@v${options.version}` : '@latest';
      const args = ['get', `${options.packageName}${version}`];
      const command = formatCommand(args);
      const { success, stderr } = await runCommand(args, ctx.cwd);

      return {
        action: 'install',
        ecosystem: 'go',
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
      // Go requires two steps: drop the require directive, then tidy
      const dropArgs = ['mod', 'edit', '-droprequire', options.packageName];
      const command = `${formatCommand(dropArgs)} && go mod tidy`;

      const dropResult = await runCommand(dropArgs, ctx.cwd);
      if (!dropResult.success) {
        return {
          action: 'remove',
          ecosystem: 'go',
          packageName: options.packageName,
          modulePath: ctx.modulePath,
          status: 'failure',
          previousVersion: null,
          newVersion: null,
          error: dropResult.stderr,
          command,
        };
      }

      const tidyResult = await runCommand(['mod', 'tidy'], ctx.cwd);

      return {
        action: 'remove',
        ecosystem: 'go',
        packageName: options.packageName,
        modulePath: ctx.modulePath,
        status: tidyResult.success ? 'success' : 'failure',
        previousVersion: null,
        newVersion: null,
        error: tidyResult.success ? null : tidyResult.stderr,
        command,
      };
    },
  };
}
