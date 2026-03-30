/**
 * Workspace root discovery and resolution.
 *
 * Resolves relative root paths from workspace config against
 * the config file directory and validates they exist.
 */

import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { WorkspaceConfig } from '@deckgraph/shared';
import { createLogger } from '../logger.js';

const logger = createLogger('workspaceDiscovery');

/**
 * A resolved root path with its absolute path.
 */
export interface ResolvedRoot {
  /** Absolute path to the project root */
  readonly absolutePath: string;
  /** Original path from config (for reference) */
  readonly originalPath: string;
}

/**
 * Discover and resolve workspace root paths from config.
 *
 * - Resolves relative paths against the config directory
 * - Validates each root exists and is a directory
 * - Returns [configRoot] if no roots in config (single-project mode)
 *
 * @throws Error if any root is invalid or does not exist
 */
export async function discoverRoots(
  configRoot: string,
  config: WorkspaceConfig | null,
): Promise<readonly ResolvedRoot[]> {
  // No workspace config = single-project mode
  if (!config) {
    return [{ absolutePath: resolve(configRoot), originalPath: configRoot }];
  }

  const normalizedConfigRoot = resolve(configRoot);
  const resolved: ResolvedRoot[] = [];
  const seen = new Set<string>();

  for (const root of config.roots) {
    const absolutePath = resolve(configRoot, root);

    // Path traversal check: resolved path must stay within config root
    if (
      !absolutePath.startsWith(normalizedConfigRoot + '/') &&
      absolutePath !== normalizedConfigRoot
    ) {
      throw new Error(
        `Invalid workspace root "${root}": path escapes project root "${normalizedConfigRoot}"`,
      );
    }

    // Duplicate check
    if (seen.has(absolutePath)) {
      throw new Error(
        `Duplicate workspace root: "${root}" resolves to "${absolutePath}"`,
      );
    }
    seen.add(absolutePath);

    try {
      // Verify it's actually a directory we can read
      await readdir(absolutePath, { withFileTypes: true });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'unknown error';
      throw new Error(
        `Invalid workspace root "${root}": ${detail}`,
      );
    }

    resolved.push({ absolutePath, originalPath: root });
  }

  logger.info(
    { rootCount: resolved.length, roots: resolved.map((r) => r.absolutePath) },
    'Workspace roots discovered',
  );

  return resolved;
}

