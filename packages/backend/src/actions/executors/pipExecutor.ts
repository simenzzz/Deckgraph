/**
 * Executor for Python (pypi) ecosystem package management.
 *
 * Detects whether the project uses Poetry (pyproject.toml with [tool.poetry])
 * or pip, and delegates to the correct CLI.
 */

import { existsSync, readFileSync } from 'node:fs';
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

type PythonPackageManager = 'poetry' | 'pip';

function detectPythonPM(ctx: ExecutorContext): PythonPackageManager {
  const pyprojectPath = path.join(ctx.cwd, 'pyproject.toml');
  if (existsSync(pyprojectPath)) {
    try {
      const content = readFileSync(pyprojectPath, 'utf-8');
      if (content.includes('[tool.poetry]')) return 'poetry';
    } catch {
      // Fall through to pip
    }
  }
  return 'pip';
}

function formatCommand(pm: PythonPackageManager, args: readonly string[]): string {
  return `${pm} ${args.join(' ')}`;
}

async function runCommand(
  pm: PythonPackageManager,
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

function poetryGroup(scope: string): string[] {
  switch (scope) {
    case 'dev':
      return ['--group', 'dev'];
    case 'build':
      return ['--group', 'build'];
    case 'optional':
      return ['--optional'];
    default:
      return [];
  }
}

export function createPipExecutor(): EcosystemExecutor {
  return {
    ecosystem: 'pypi',

    async update(ctx: ExecutorContext, options: UpdateOptions): Promise<PackageActionResult> {
      const pm = detectPythonPM(ctx);
      const args =
        pm === 'poetry'
          ? ['add', `${options.packageName}@${options.targetVersion}`, ...poetryGroup(options.scope)]
          : ['install', `${options.packageName}==${options.targetVersion}`];

      const command = formatCommand(pm, args);
      const { success, stderr } = await runCommand(pm, args, ctx.cwd);

      return {
        action: 'update',
        ecosystem: 'pypi',
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
      const pm = detectPythonPM(ctx);
      const pkg = options.version
        ? `${options.packageName}==${options.version}`
        : options.packageName;
      const args =
        pm === 'poetry'
          ? ['add', options.version ? `${options.packageName}@${options.version}` : options.packageName, ...poetryGroup(options.scope)]
          : ['install', pkg];

      const command = formatCommand(pm, args);
      const { success, stderr } = await runCommand(pm, args, ctx.cwd);

      return {
        action: 'install',
        ecosystem: 'pypi',
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
      const pm = detectPythonPM(ctx);
      const args =
        pm === 'poetry'
          ? ['remove', options.packageName]
          : ['uninstall', options.packageName, '-y'];

      const command = formatCommand(pm, args);
      const { success, stderr } = await runCommand(pm, args, ctx.cwd);

      return {
        action: 'remove',
        ecosystem: 'pypi',
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
