/**
 * File scanner utility for cross-language detectors.
 *
 * Wraps fast-glob with shared ignore patterns to find specific
 * file types needed by each detector.
 */

import { dirname } from 'node:path';
import fg from 'fast-glob';
import type { Module } from '@deckgraph/shared';
import { DEFAULT_IGNORE_PATTERNS } from '../discovery/moduleDiscovery.js';

/**
 * Find files matching the given glob patterns under a project root.
 * Uses shared ignore patterns to skip node_modules, dist, etc.
 *
 * @param projectRoot - Absolute path to the project root
 * @param patterns - Glob patterns to match (e.g. ['**\/*.proto'])
 * @returns Matched file paths relative to projectRoot
 */
export async function findFiles(
  projectRoot: string,
  patterns: readonly string[],
): Promise<readonly string[]> {
  return fg([...patterns], {
    cwd: projectRoot,
    ignore: [...DEFAULT_IGNORE_PATTERNS],
    dot: false,
    onlyFiles: true,
    followSymbolicLinks: false,
  });
}

/**
 * Find the module that owns the given file path.
 *
 * Matches the file's directory against module paths, preferring the
 * most specific (longest) module path. Returns null if no module matches.
 *
 * @param filePath - File path relative to project root
 * @param modules - Available modules to search
 */
export function findOwningModule(
  filePath: string,
  modules: readonly Module[],
): Module | null {
  const dir = dirname(filePath);

  // Sort by path length descending to find most specific match
  const sorted = [...modules].sort((a, b) => b.path.length - a.path.length);

  for (const mod of sorted) {
    const modulePath = mod.path === '.' ? '' : mod.path;
    if (dir === modulePath || dir.startsWith(modulePath ? `${modulePath}/` : '')) {
      return mod;
    }
  }

  return null;
}
