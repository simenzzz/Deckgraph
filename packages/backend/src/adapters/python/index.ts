/**
 * Python/PyPI ecosystem adapter.
 *
 * Handles Python packages: pyproject.toml, setup.cfg, requirements.txt,
 * Pipfile manifests, Python source files, and PyPI registry queries.
 */

import type { EcosystemAdapter, ManifestResult, ParsedImport, RegistryQueryResult } from '@deckgraph/shared';
import type { RegistryCache } from '../registryCache.js';
import type { RegistryRateLimiter } from '../registryRateLimiter.js';
import { parsePythonManifests } from './manifestParser.js';
import { analyzePythonImports } from './importAnalyzer.js';
import { queryPypiRegistry } from './registryClient.js';

const PYTHON_SOURCE_EXTENSIONS: readonly string[] = ['.py', '.pyi'];

/**
 * Create a Python/PyPI ecosystem adapter.
 */
export function createPythonAdapter(
  cache?: RegistryCache,
  rateLimiter?: RegistryRateLimiter,
): EcosystemAdapter {
  return {
    ecosystem: 'pypi',
    manifestFiles: ['pyproject.toml', 'setup.cfg', 'requirements.txt', 'Pipfile'],
    sourceExtensions: PYTHON_SOURCE_EXTENSIONS,

    parseManifests(projectRoot: string, modulePath: string): Promise<ManifestResult> {
      return parsePythonManifests(projectRoot, modulePath);
    },

    analyzeImports(filePath: string, source: string): Promise<readonly ParsedImport[]> {
      return analyzePythonImports(filePath, source);
    },

    async queryRegistry(packageName: string): Promise<RegistryQueryResult> {
      if (!cache || !rateLimiter) return { status: 'error' };
      return queryPypiRegistry(packageName, cache, rateLimiter);
    },
  };
}
