/**
 * JavaScript/TypeScript ecosystem adapter.
 *
 * Handles npm packages: package.json manifests, JS/TS source files,
 * and npm registry queries.
 */

import type { EcosystemAdapter, ManifestResult, ParsedImport, RegistryQueryResult } from '@deckgraph/shared';
import type { RegistryCache } from '../registryCache.js';
import type { RegistryRateLimiter } from '../registryRateLimiter.js';
import { parseJsManifests } from './manifestParser.js';
import { analyzeJsImports } from './importAnalyzer.js';
import { queryNpmRegistry } from './registryClient.js';

/**
 * Source file extensions handled by the JS/TS adapter.
 */
const JS_SOURCE_EXTENSIONS: readonly string[] = [
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
];

/**
 * Create a JavaScript/TypeScript ecosystem adapter.
 */
export function createJavaScriptAdapter(
  cache?: RegistryCache,
  rateLimiter?: RegistryRateLimiter,
): EcosystemAdapter {
  return {
    ecosystem: 'npm',
    manifestFiles: ['package.json'],
    sourceExtensions: JS_SOURCE_EXTENSIONS,

    parseManifests(projectRoot: string, modulePath: string): Promise<ManifestResult> {
      return parseJsManifests(projectRoot, modulePath);
    },

    async analyzeImports(filePath: string, source: string): Promise<readonly ParsedImport[]> {
      return analyzeJsImports(filePath, source);
    },

    async queryRegistry(packageName: string): Promise<RegistryQueryResult> {
      if (!cache || !rateLimiter) return { status: 'error' };
      return queryNpmRegistry(packageName, cache, rateLimiter);
    },
  };
}
