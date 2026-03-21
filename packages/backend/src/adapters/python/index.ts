/**
 * Python/PyPI ecosystem adapter.
 *
 * Handles Python packages: pyproject.toml, setup.cfg, requirements.txt,
 * Pipfile manifests, Python source files, and PyPI registry queries.
 */

import type { EcosystemAdapter, ManifestResult, ParsedImport, RegistryMeta } from '@deckgraph/shared';
import { parsePythonManifests } from './manifestParser.js';

const PYTHON_SOURCE_EXTENSIONS: readonly string[] = ['.py', '.pyi'];

/**
 * Create a Python/PyPI ecosystem adapter.
 *
 * Phase 1: parseManifests is fully implemented.
 * Phase 2: analyzeImports will be implemented later.
 * Phase 3: queryRegistry will be implemented later.
 */
export function createPythonAdapter(): EcosystemAdapter {
  return {
    ecosystem: 'pypi',
    manifestFiles: ['pyproject.toml', 'setup.cfg', 'requirements.txt', 'Pipfile'],
    sourceExtensions: PYTHON_SOURCE_EXTENSIONS,

    parseManifests(projectRoot: string, modulePath: string): Promise<ManifestResult> {
      return parsePythonManifests(projectRoot, modulePath);
    },

    analyzeImports(_filePath: string, _source: string): readonly ParsedImport[] {
      throw new Error('Import analysis not implemented yet (Phase 2)');
    },

    async queryRegistry(_packageName: string): Promise<RegistryMeta | null> {
      return null;
    },
  };
}
