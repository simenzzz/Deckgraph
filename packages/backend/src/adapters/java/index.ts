/**
 * Java/Maven/Gradle ecosystem adapter.
 *
 * Handles JVM projects: pom.xml / build.gradle manifests, Java/Kotlin source files,
 * and Maven Central registry queries.
 */

import type { EcosystemAdapter, ManifestResult, ParsedImport, RegistryMeta } from '@deckgraph/shared';
import { parseJavaManifests } from './manifestParser.js';

const JAVA_SOURCE_EXTENSIONS: readonly string[] = ['.java', '.kt', '.kts'];

/**
 * Create a Java/Maven ecosystem adapter.
 *
 * Phase 1: parseManifests is fully implemented.
 * Phase 2: analyzeImports will be implemented later.
 * Phase 3: queryRegistry will be implemented later.
 */
export function createJavaAdapter(): EcosystemAdapter {
  return {
    ecosystem: 'maven',
    manifestFiles: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
    sourceExtensions: JAVA_SOURCE_EXTENSIONS,

    parseManifests(projectRoot: string, modulePath: string): Promise<ManifestResult> {
      return parseJavaManifests(projectRoot, modulePath);
    },

    analyzeImports(_filePath: string, _source: string): readonly ParsedImport[] {
      throw new Error('Import analysis not implemented yet (Phase 2)');
    },

    async queryRegistry(_packageName: string): Promise<RegistryMeta | null> {
      return null;
    },
  };
}
