/**
 * JavaScript/TypeScript ecosystem adapter.
 *
 * Handles npm packages: package.json manifests, JS/TS source files,
 * and npm registry queries.
 */

import type { EcosystemAdapter, ManifestResult, ParsedImport, RegistryMeta } from '@deckgraph/shared';
import { parseJsManifests } from './manifestParser.js';

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
 *
 * Phase 1: parseManifests is fully implemented.
 * Phase 2: analyzeImports will be implemented later.
 * Phase 3: queryRegistry will be implemented later.
 */
export function createJavaScriptAdapter(): EcosystemAdapter {
  return {
    ecosystem: 'npm',
    manifestFiles: ['package.json'],
    sourceExtensions: JS_SOURCE_EXTENSIONS,

    parseManifests(projectRoot: string, modulePath: string): Promise<ManifestResult> {
      return parseJsManifests(projectRoot, modulePath);
    },

    analyzeImports(_filePath: string, _source: string): readonly ParsedImport[] {
      throw new Error('Import analysis not implemented yet (Phase 2)');
    },

    async queryRegistry(_packageName: string): Promise<RegistryMeta | null> {
      // Phase 3: will query npm registry API
      return null;
    },
  };
}
