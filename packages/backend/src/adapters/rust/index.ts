/**
 * Rust/Cargo ecosystem adapter.
 *
 * Handles Cargo packages: Cargo.toml manifests, Rust source files,
 * and crates.io registry queries.
 */

import type { EcosystemAdapter, ManifestResult, ParsedImport, RegistryQueryResult } from '@deckgraph/shared';
import type { RegistryCache } from '../registryCache.js';
import type { RegistryRateLimiter } from '../registryRateLimiter.js';
import { parseRustManifests } from './manifestParser.js';
import { analyzeRustImports } from './importAnalyzer.js';
import { queryCargoRegistry } from './registryClient.js';

const RUST_SOURCE_EXTENSIONS: readonly string[] = ['.rs'];

/**
 * Create a Rust/Cargo ecosystem adapter.
 */
export function createRustAdapter(
  cache?: RegistryCache,
  rateLimiter?: RegistryRateLimiter,
): EcosystemAdapter {
  return {
    ecosystem: 'cargo',
    manifestFiles: ['Cargo.toml'],
    sourceExtensions: RUST_SOURCE_EXTENSIONS,

    parseManifests(projectRoot: string, modulePath: string): Promise<ManifestResult> {
      return parseRustManifests(projectRoot, modulePath);
    },

    analyzeImports(filePath: string, source: string): Promise<readonly ParsedImport[]> {
      return analyzeRustImports(filePath, source);
    },

    async queryRegistry(packageName: string): Promise<RegistryQueryResult> {
      if (!cache || !rateLimiter) return { status: 'error' };
      return queryCargoRegistry(packageName, cache, rateLimiter);
    },
  };
}
