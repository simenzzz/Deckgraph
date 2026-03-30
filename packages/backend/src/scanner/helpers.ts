/**
 * Shared helpers for scanner and incremental scanner.
 *
 * Extracted from scanner.ts so both full and incremental scanning
 * can reuse the same module-building logic.
 */

import { availableParallelism } from 'node:os';
import type {
  AdapterRegistry,
  Dependency,
  EcosystemAdapter,
  Ecosystem,
  ManifestResult,
  MinimalDependency,
  Module,
} from '@deckgraph/shared';
import type { DiscoveredModule } from '../discovery/moduleDiscovery.js';
import { createLogger } from '../logger.js';

const logger = createLogger('scanner');

/** Maximum concurrency for parallel module building */
const MAX_CONCURRENCY = 8;

/**
 * Find the adapter for a discovered module by checking its manifest files.
 */
export function findAdapter(
  disc: DiscoveredModule,
  registry: AdapterRegistry,
): EcosystemAdapter | null {
  for (const manifest of disc.manifests) {
    const adapter = registry.getAdapterForManifest(manifest);
    if (adapter) return adapter;
  }
  return null;
}

/**
 * Convert a DiscoveredModule + ManifestResult into a full Module.
 */
export function buildModule(
  disc: DiscoveredModule,
  manifest: ManifestResult,
): Module {
  return {
    path: disc.path,
    name: manifest.moduleName,
    ecosystem: disc.ecosystem,
    manifests: [...disc.manifests],
    dependencies: manifest.dependencies.map((d) =>
      toFullDependency(d, disc.ecosystem),
    ),
    analysisState: 'manifest-only',
  };
}

/**
 * Convert a MinimalDependency (from adapter) into a full Dependency.
 * Fills in Phase 1 defaults for lazy fields.
 */
export function toFullDependency(
  minimal: MinimalDependency,
  ecosystem: Ecosystem,
): Dependency {
  return {
    name: minimal.name,
    ecosystem,
    version: minimal.version,
    constraint: minimal.constraint,
    scope: minimal.scope,
    source: 'manifest',
    concerns: [],
    usedInFiles: null,
    transitiveDeps: null,
    registryMeta: null,
  };
}

/**
 * Parse manifests for all discovered modules and convert to full Module objects.
 * Skips modules with no adapter or adapter errors.
 *
 * Uses concurrency-limited parallel execution for better performance
 * on large monorepos.
 */
export async function buildModules(
  discovered: readonly DiscoveredModule[],
  projectRoot: string,
  registry: AdapterRegistry,
): Promise<readonly Module[]> {
  if (discovered.length === 0) return [];

  const concurrency = Math.min(
    Math.max(availableParallelism(), 1),
    MAX_CONCURRENCY,
  );

  return runWithConcurrency(
    discovered,
    concurrency,
    async (disc): Promise<Module | null> => {
      const adapter = findAdapter(disc, registry);
      if (!adapter) {
        logger.warn(
          { path: disc.path, ecosystem: disc.ecosystem },
          'No adapter registered — skipping module',
        );
        return null;
      }

      try {
        const manifest = await adapter.parseManifests(projectRoot, disc.path);
        return buildModule(disc, manifest);
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'unknown error';
        logger.error(
          { path: disc.path, error: detail },
          'Manifest parsing failed — skipping module',
        );
        return null;
      }
    },
  );
}

/**
 * Run a function over items with limited concurrency.
 *
 * Uses a worker pool pattern: N workers pull from a shared index,
 * collecting non-null results. No external dependencies needed.
 */
async function runWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<R | null>,
): Promise<readonly R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const currentIndex = index++;
      const item = items[currentIndex]!;
      try {
        const result = await fn(item);
        if (result !== null) {
          results.push(result);
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'unknown error';
        logger.error({ index: currentIndex, error: detail }, 'Worker error');
      }
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(
    Array.from({ length: workerCount }, () => worker()),
  );

  return results;
}

/**
 * Count total dependencies across all modules.
 */
export function countDeps(modules: readonly Module[]): number {
  let count = 0;
  for (const mod of modules) {
    count += mod.dependencies.length;
  }
  return count;
}
