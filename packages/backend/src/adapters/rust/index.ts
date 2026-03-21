/**
 * Rust/Cargo ecosystem adapter.
 *
 * Handles Cargo packages: Cargo.toml manifests, Rust source files,
 * and crates.io registry queries.
 */

import type { EcosystemAdapter, ManifestResult, ParsedImport, RegistryMeta } from '@deckgraph/shared';
import { parseRustManifests } from './manifestParser.js';

const RUST_SOURCE_EXTENSIONS: readonly string[] = ['.rs'];

/**
 * Create a Rust/Cargo ecosystem adapter.
 *
 * Phase 1: parseManifests is fully implemented.
 * Phase 2: analyzeImports will be implemented later.
 * Phase 3: queryRegistry will be implemented later.
 */
export function createRustAdapter(): EcosystemAdapter {
  return {
    ecosystem: 'cargo',
    manifestFiles: ['Cargo.toml'],
    sourceExtensions: RUST_SOURCE_EXTENSIONS,

    parseManifests(projectRoot: string, modulePath: string): Promise<ManifestResult> {
      return parseRustManifests(projectRoot, modulePath);
    },

    analyzeImports(_filePath: string, _source: string): readonly ParsedImport[] {
      throw new Error('Import analysis not implemented yet (Phase 2)');
    },

    async queryRegistry(_packageName: string): Promise<RegistryMeta | null> {
      return null;
    },
  };
}
