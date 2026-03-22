/**
 * Java/Maven/Gradle ecosystem adapter.
 *
 * Handles JVM projects: pom.xml / build.gradle manifests, Java/Kotlin source files,
 * and Maven Central registry queries.
 */

import type { EcosystemAdapter, ManifestResult, ParsedImport, RegistryMeta } from '@deckgraph/shared';
import type { RegistryCache } from '../registryCache.js';
import type { RegistryRateLimiter } from '../registryRateLimiter.js';
import { parseJavaManifests } from './manifestParser.js';
import { analyzeJavaImports } from './importAnalyzer.js';
import { queryMavenRegistry } from './registryClient.js';

const JAVA_SOURCE_EXTENSIONS: readonly string[] = ['.java', '.kt', '.kts'];

/**
 * Create a Java/Maven ecosystem adapter.
 */
export function createJavaAdapter(
  cache?: RegistryCache,
  rateLimiter?: RegistryRateLimiter,
): EcosystemAdapter {
  return {
    ecosystem: 'maven',
    manifestFiles: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
    sourceExtensions: JAVA_SOURCE_EXTENSIONS,

    parseManifests(projectRoot: string, modulePath: string): Promise<ManifestResult> {
      return parseJavaManifests(projectRoot, modulePath);
    },

    analyzeImports(filePath: string, source: string): Promise<readonly ParsedImport[]> {
      return analyzeJavaImports(filePath, source);
    },

    async queryRegistry(packageName: string): Promise<RegistryMeta | null> {
      if (!cache || !rateLimiter) return null;
      return queryMavenRegistry(packageName, cache, rateLimiter);
    },
  };
}
