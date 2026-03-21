/**
 * Shared adapter utilities.
 *
 * Common helpers used across ecosystem-specific manifest parsers.
 */

import { readFile } from 'node:fs/promises';

/**
 * Read a file, returning null if it does not exist.
 * Swallows ENOENT; all other errors propagate.
 */
export async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * Return unique directories to search: moduleDir first, then projectRoot
 * (only if different from moduleDir).
 */
export function uniqueDirs(moduleDir: string, projectRoot: string): readonly string[] {
  if (moduleDir === projectRoot) {
    return [moduleDir];
  }
  return [moduleDir, projectRoot];
}
