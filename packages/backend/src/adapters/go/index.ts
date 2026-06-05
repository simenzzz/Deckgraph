/**
 * Go ecosystem adapter.
 *
 * Handles Go modules: go.mod manifests, Go source files,
 * and Go proxy registry queries.
 */

import type { EcosystemAdapter, ManifestResult, ParsedImport, RegistryQueryResult } from '@deckgraph/shared';
import type { RegistryCache } from '../registryCache.js';
import type { RegistryRateLimiter } from '../registryRateLimiter.js';
import { parseGoManifests } from './manifestParser.js';
import { analyzeGoImports } from './importAnalyzer.js';
import { queryGoRegistry } from './registryClient.js';

const GO_SOURCE_EXTENSIONS: readonly string[] = ['.go'];

/**
 * Create a Go ecosystem adapter.
 */
export function createGoAdapter(
  cache?: RegistryCache,
  rateLimiter?: RegistryRateLimiter,
): EcosystemAdapter {
  return {
    ecosystem: 'go',
    manifestFiles: ['go.mod'],
    sourceExtensions: GO_SOURCE_EXTENSIONS,

    parseManifests(projectRoot: string, modulePath: string): Promise<ManifestResult> {
      return parseGoManifests(projectRoot, modulePath);
    },

    analyzeImports(filePath: string, source: string): Promise<readonly ParsedImport[]> {
      return analyzeGoImports(filePath, source);
    },

    async queryRegistry(packageName: string): Promise<RegistryQueryResult> {
      if (!cache || !rateLimiter) return { status: 'error' };
      return queryGoRegistry(packageName, cache, rateLimiter);
    },
  };
}
