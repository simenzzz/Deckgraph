/**
 * AdapterRegistry implementation.
 *
 * Maps manifest filenames, source extensions, and ecosystems
 * to their corresponding EcosystemAdapter instances.
 */

import type { Ecosystem, EcosystemAdapter, AdapterRegistry } from '@deckgraph/shared';

/**
 * Create a new AdapterRegistry instance.
 *
 * The registry maintains three internal maps for fast lookups:
 * - manifest filename → adapter
 * - source extension → adapter
 * - ecosystem → adapter
 */
export function createAdapterRegistry(): AdapterRegistry {
  const byManifest = new Map<string, EcosystemAdapter>();
  const byExtension = new Map<string, EcosystemAdapter>();
  const byEcosystem = new Map<Ecosystem, EcosystemAdapter>();

  return {
    register(adapter: EcosystemAdapter): void {
      if (byEcosystem.has(adapter.ecosystem)) {
        throw new Error(
          `Adapter for ecosystem '${adapter.ecosystem}' is already registered`,
        );
      }

      byEcosystem.set(adapter.ecosystem, adapter);

      for (const manifest of adapter.manifestFiles) {
        byManifest.set(manifest, adapter);
      }

      for (const ext of adapter.sourceExtensions) {
        byExtension.set(ext, adapter);
      }
    },

    getAdapterForManifest(manifestFileName: string): EcosystemAdapter | null {
      return byManifest.get(manifestFileName) ?? null;
    },

    getAdapterForExtension(extension: string): EcosystemAdapter | null {
      return byExtension.get(extension) ?? null;
    },

    getRegisteredEcosystems(): readonly Ecosystem[] {
      return [...byEcosystem.keys()];
    },
  };
}
