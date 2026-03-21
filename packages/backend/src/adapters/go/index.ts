/**
 * Go ecosystem adapter.
 *
 * Handles Go modules: go.mod manifests, Go source files,
 * and Go proxy registry queries.
 */

import type { EcosystemAdapter, ManifestResult, ParsedImport, RegistryMeta } from '@deckgraph/shared';
import { parseGoManifests } from './manifestParser.js';

const GO_SOURCE_EXTENSIONS: readonly string[] = ['.go'];

/**
 * Create a Go ecosystem adapter.
 *
 * Phase 1: parseManifests is fully implemented.
 * Phase 2: analyzeImports will be implemented later.
 * Phase 3: queryRegistry will be implemented later.
 */
export function createGoAdapter(): EcosystemAdapter {
  return {
    ecosystem: 'go',
    manifestFiles: ['go.mod'],
    sourceExtensions: GO_SOURCE_EXTENSIONS,

    parseManifests(projectRoot: string, modulePath: string): Promise<ManifestResult> {
      return parseGoManifests(projectRoot, modulePath);
    },

    analyzeImports(_filePath: string, _source: string): readonly ParsedImport[] {
      throw new Error('Import analysis not implemented yet (Phase 2)');
    },

    async queryRegistry(_packageName: string): Promise<RegistryMeta | null> {
      return null;
    },
  };
}
