/**
 * Maps manifest filenames to their ecosystem.
 *
 * Pure lookup — no I/O, no side effects.
 */

import type { Ecosystem } from '@deckgraph/shared';

/**
 * Mapping from manifest filename to the ecosystem it belongs to.
 */
const MANIFEST_TO_ECOSYSTEM: ReadonlyMap<string, Ecosystem> = new Map<string, Ecosystem>([
  // npm (JS/TS)
  ['package.json', 'npm'],

  // PyPI (Python)
  ['pyproject.toml', 'pypi'],
  ['setup.cfg', 'pypi'],
  ['requirements.txt', 'pypi'],
  ['Pipfile', 'pypi'],
  ['setup.py', 'pypi'],

  // Go
  ['go.mod', 'go'],

  // Cargo (Rust)
  ['Cargo.toml', 'cargo'],

  // Maven (Java)
  ['pom.xml', 'maven'],
  ['build.gradle', 'maven'],
  ['build.gradle.kts', 'maven'],
]);

/**
 * Detect the ecosystem for a given manifest filename.
 * Returns null if the filename is not a recognized manifest.
 */
export function detectEcosystem(fileName: string): Ecosystem | null {
  return MANIFEST_TO_ECOSYSTEM.get(fileName) ?? null;
}

/**
 * Get all recognized manifest filenames.
 */
export function getAllManifestFileNames(): readonly string[] {
  return [...MANIFEST_TO_ECOSYSTEM.keys()];
}
