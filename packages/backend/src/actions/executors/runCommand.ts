/**
 * Shared subprocess runner for ecosystem executors.
 *
 * Wraps execa with shell: false (no shell injection) and a configurable timeout.
 */

import { execa } from 'execa';

const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Execute a subprocess command and return a success/failure result.
 *
 * Uses execa with shell: false and array args to prevent shell injection.
 */
export async function runCommand(
  cmd: string,
  args: readonly string[],
  cwd: string,
  timeout: number = DEFAULT_TIMEOUT_MS,
): Promise<{ success: boolean; stderr: string }> {
  try {
    await execa(cmd, args, { cwd, timeout, shell: false });
    return { success: true, stderr: '' };
  } catch (error: unknown) {
    const stderr =
      error !== null && typeof error === 'object' && 'stderr' in error
        ? String(error.stderr)
        : String(error);
    return { success: false, stderr };
  }
}
