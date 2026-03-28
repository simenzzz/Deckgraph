/**
 * Shared helpers for scanner and incremental scanner.
 *
 * Extracted from scanner.ts so both full and incremental scanning
 * can reuse the same module-building logic.
 */

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
 */
export async function buildModules(
  discovered: readonly DiscoveredModule[],
  projectRoot: string,
  registry: AdapterRegistry,
): Promise<readonly Module[]> {
  const modules: Module[] = [];

  for (const disc of discovered) {
    const adapter = findAdapter(disc, registry);
    if (!adapter) {
      logger.warn(
        { path: disc.path, ecosystem: disc.ecosystem },
        'No adapter registered — skipping module',
      );
      continue;
    }

    try {
      const manifest = await adapter.parseManifests(projectRoot, disc.path);
      const mod = buildModule(disc, manifest);
      modules.push(mod);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'unknown error';
      logger.error(
        { path: disc.path, error: detail },
        'Manifest parsing failed — skipping module',
      );
    }
  }

  return modules;
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
