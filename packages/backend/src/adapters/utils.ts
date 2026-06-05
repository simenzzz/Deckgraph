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
 * True when a parsed manifest dependency value is a table that points at a
 * filesystem `path` (e.g. cargo `{ path = "../crate" }`, Poetry/Pipfile
 * `{ path = "../lib" }`). Such dependencies are local/workspace members, not
 * published to a public registry. The path itself is never used for any
 * filesystem access — this is a read-only type check that yields a boolean.
 */
export function hasStringPathField(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>)['path'] === 'string'
  );
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
