/**
 * Content hasher for incremental file watching.
 *
 * Uses xxhash-wasm for fast, deterministic content hashing.
 * All functions are pure — input maps are never mutated.
 */

import { readFile } from 'node:fs/promises';
import xxhash from 'xxhash-wasm';

/**
 * Result of comparing two hash maps.
 */
export interface ContentHashDiff {
  readonly updated: readonly string[];
  readonly added: readonly string[];
  readonly removed: readonly string[];
}

// Module-level hasher singleton (initialized once via initHasher)
let hasherInstance: Awaited<ReturnType<typeof xxhash>> | null = null;

/**
 * Initialize the xxhash WASM module (must be called once before computeHash).
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export async function initHasher(): Promise<void> {
  if (hasherInstance) return;
  hasherInstance = await xxhash();
}

/**
 * Compute a 64-bit xxhash of the given content.
 * Throws if initHasher() has not been called.
 */
export function computeHash(content: Buffer): string {
  if (!hasherInstance) {
    throw new Error('Hasher not initialized — call initHasher() first');
  }
  const hasher = hasherInstance.create64();
  hasher.update(content);
  return hasher.digest().toString(16);
}

/**
 * Read a file and return its content hash.
 * Throws if the file cannot be read or hasher is not initialized.
 */
export async function hashFile(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return computeHash(content);
}

/**
 * Compare two hash maps and return the differences.
 * Pure function — never mutates the input maps.
 *
 * @param previous - Hash map from the previous scan
 * @param current - Hash map from the current scan
 * @returns Files that were updated, added, or removed
 */
export function diffHashes(
  previous: ReadonlyMap<string, string>,
  current: ReadonlyMap<string, string>,
): ContentHashDiff {
  const updated: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];

  for (const [path, hash] of current) {
    const prevHash = previous.get(path);
    if (prevHash === undefined) {
      added.push(path);
    } else if (prevHash !== hash) {
      updated.push(path);
    }
  }

  for (const path of previous.keys()) {
    if (!current.has(path)) {
      removed.push(path);
    }
  }

  return { updated, added, removed };
}
