/**
 * Module discovery via filesystem scanning.
 *
 * Walks the project directory using fast-glob, finds all known
 * manifest files, and groups them by directory into discovered modules.
 */

import { dirname, basename } from 'node:path';
import fg from 'fast-glob';
import type { Ecosystem, ProjectConfig } from '@deckgraph/shared';
import { detectEcosystem, getAllManifestFileNames } from './ecosystemDetector.js';
import { createLogger } from '../logger.js';

const logger = createLogger('moduleDiscovery');

/**
 * A discovered module directory with its manifest files and primary ecosystem.
 */
export interface DiscoveredModule {
  /** Relative path from project root (e.g. "packages/backend") */
  readonly path: string;
  /** Manifest filenames found in this directory */
  readonly manifests: readonly string[];
  /** Primary ecosystem (determined by highest-priority manifest) */
  readonly ecosystem: Ecosystem;
}

/**
 * Default directories to ignore during discovery.
 * These are common build output, dependency, and cache directories.
 * Exported for reuse by cross-language edge detectors.
 */
export const DEFAULT_IGNORE_PATTERNS: readonly string[] = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/vendor/**',
  '**/target/**',
  '**/__pycache__/**',
  '**/build/**',
  '**/.turbo/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/venv/**',
  '**/.venv/**',
  '**/env/**',
  '**/.tox/**',
];

/**
 * Ecosystem priority for when multiple manifests exist in one directory.
 * Lower number = higher priority.
 */
const ECOSYSTEM_PRIORITY: Readonly<Record<Ecosystem, number>> = {
  npm: 1,
  pypi: 2,
  go: 3,
  cargo: 4,
  maven: 5,
};

/**
 * Discover all modules in the project root.
 *
 * Scans for known manifest filenames, groups by directory,
 * and assigns a primary ecosystem to each module.
 */
export async function discoverModules(
  projectRoot: string,
  config: ProjectConfig | null,
): Promise<readonly DiscoveredModule[]> {
  const manifestFileNames = getAllManifestFileNames();
  const ignorePatterns = buildIgnorePatterns(config);

  logger.debug(
    { projectRoot, manifestCount: manifestFileNames.length, ignoreCount: ignorePatterns.length },
    'Starting module discovery',
  );

  const globPattern =
    manifestFileNames.length === 1
      ? `**/${manifestFileNames[0]}`
      : `**/{${manifestFileNames.join(',')}}`;

  const matches = await fg(globPattern, {
    cwd: projectRoot,
    ignore: [...ignorePatterns],
    dot: false,
    onlyFiles: true,
    followSymbolicLinks: false,
  });

  const moduleMap = groupByDirectory(matches);
  const modules = toDiscoveredModules(moduleMap);

  logger.info(
    { moduleCount: modules.length, projectRoot },
    'Module discovery complete',
  );

  return modules;
}

/**
 * Merge default ignore patterns with user-configured ones.
 */
function buildIgnorePatterns(config: ProjectConfig | null): readonly string[] {
  if (!config || config.ignorePaths.length === 0) {
    return DEFAULT_IGNORE_PATTERNS;
  }

  const userPatterns = config.ignorePaths.map((p) =>
    p.includes('*') ? p : `**/${p}/**`,
  );

  return [...DEFAULT_IGNORE_PATTERNS, ...userPatterns];
}

/**
 * Group matched manifest file paths by their parent directory.
 * Paths from fast-glob are relative to cwd (e.g. "packages/app/package.json").
 *
 * Note: Uses local array mutation during construction (builder pattern).
 * Arrays are not shared until the completed Map is returned as ReadonlyMap.
 */
function groupByDirectory(
  matches: readonly string[],
): ReadonlyMap<string, readonly string[]> {
  const map = new Map<string, string[]>();

  for (const match of matches) {
    const dir = dirname(match);
    const fileName = basename(match);
    const key = dir === '.' ? '.' : dir;
    const existing = map.get(key);
    if (existing) {
      existing.push(fileName);
    } else {
      map.set(key, [fileName]);
    }
  }

  return map;
}

/**
 * Convert grouped manifest entries into DiscoveredModule objects.
 * Dirs from groupByDirectory are already relative to projectRoot
 * (fast-glob returns paths relative to cwd).
 */
function toDiscoveredModules(
  moduleMap: ReadonlyMap<string, readonly string[]>,
): readonly DiscoveredModule[] {
  const modules: DiscoveredModule[] = [];

  for (const [dir, manifests] of moduleMap) {
    const ecosystem = pickPrimaryEcosystem(manifests);
    if (!ecosystem) {
      logger.warn({ dir, manifests }, 'No recognized ecosystem for manifests');
      continue;
    }

    modules.push({
      path: dir || '.',
      manifests,
      ecosystem,
    });
  }

  return modules.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Pick the highest-priority ecosystem from a set of manifest filenames.
 */
function pickPrimaryEcosystem(manifests: readonly string[]): Ecosystem | null {
  let best: Ecosystem | null = null;
  let bestPriority = Infinity;

  for (const manifest of manifests) {
    const eco = detectEcosystem(manifest);
    if (eco) {
      const priority = ECOSYSTEM_PRIORITY[eco];
      if (priority < bestPriority) {
        best = eco;
        bestPriority = priority;
      }
    }
  }

  return best;
}
