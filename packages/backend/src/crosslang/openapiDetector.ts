/**
 * OpenAPI/Swagger cross-language edge detector.
 *
 * Finds OpenAPI spec files and matches them to modules that
 * likely consume the API (generated clients, matching paths).
 */

import type { CrossEdge, Module } from '@deckgraph/shared';
import { readFileSafe } from '../adapters/utils.js';
import { findFiles, findOwningModule } from './fileScanner.js';
import type { EdgeDetector } from './types.js';
import { createLogger } from '../logger.js';
import { join } from 'node:path';
import yaml from 'js-yaml';

const logger = createLogger('openapiDetector');

/** File patterns for OpenAPI/Swagger specs */
const SPEC_PATTERNS = [
  '**/openapi.yaml',
  '**/openapi.yml',
  '**/openapi.json',
  '**/swagger.yaml',
  '**/swagger.yml',
  '**/swagger.json',
];

/** Directory names that indicate generated API clients */
const CLIENT_DIR_PATTERNS = [
  'generated',
  'api-client',
  'client',
  'openapi-client',
  'swagger-client',
];

interface SpecInfo {
  readonly filePath: string;
  readonly title: string | null;
  readonly pathCount: number;
}

export function createOpenapiDetector(): EdgeDetector {
  return {
    name: 'openapi',

    async detect(
      projectRoot: string,
      modules: readonly Module[],
    ): Promise<readonly CrossEdge[]> {
      const specFiles = await findFiles(projectRoot, SPEC_PATTERNS);
      if (specFiles.length === 0) return [];

      logger.debug({ count: specFiles.length }, 'Found OpenAPI spec files');

      const specs = await Promise.all(
        specFiles.map((f) => parseSpecFile(projectRoot, f)),
      );
      const validSpecs = specs.filter(
        (s): s is SpecInfo => s !== null,
      );

      if (validSpecs.length === 0) return [];

      return matchSpecsToModules(validSpecs, modules);
    },
  };
}

async function parseSpecFile(
  projectRoot: string,
  filePath: string,
): Promise<SpecInfo | null> {
  const content = await readFileSafe(join(projectRoot, filePath));
  if (!content) return null;

  try {
    const parsed = filePath.endsWith('.json')
      ? JSON.parse(content)
      : yaml.load(content, { schema: yaml.JSON_SCHEMA });

    if (!parsed || typeof parsed !== 'object') return null;

    const spec = parsed as Record<string, unknown>;
    const info = spec['info'] as Record<string, unknown> | undefined;
    const title = typeof info?.['title'] === 'string' ? info['title'] : null;
    const paths = spec['paths'] as Record<string, unknown> | undefined;
    const pathCount = paths ? Object.keys(paths).length : 0;

    return { filePath, title, pathCount };
  } catch {
    logger.warn({ filePath }, 'Failed to parse OpenAPI spec');
    return null;
  }
}

function matchSpecsToModules(
  specs: readonly SpecInfo[],
  modules: readonly Module[],
): readonly CrossEdge[] {
  const edges: CrossEdge[] = [];

  for (const spec of specs) {
    const sourceModule = findOwningModule(spec.filePath, modules);
    if (!sourceModule) continue;

    for (const targetModule of modules) {
      if (targetModule.path === sourceModule.path) continue;
      if (targetModule.ecosystem === sourceModule.ecosystem) continue;

      const isClient = isLikelyApiClient(targetModule);
      if (!isClient) continue;

      edges.push({
        from: { module: sourceModule.path, ecosystem: sourceModule.ecosystem },
        to: { module: targetModule.path, ecosystem: targetModule.ecosystem },
        type: 'openapi',
        evidence: `OpenAPI spec "${spec.title ?? spec.filePath}" (${spec.pathCount} paths) consumed by ${targetModule.path}`,
        confidence: 0.7,
      });
    }
  }

  return edges;
}

/**
 * Check if a module looks like it consumes an API
 * (has HTTP client dependencies or generated client directories).
 */
function isLikelyApiClient(module: Module): boolean {
  const hasHttpDeps = module.dependencies.some(
    (d) =>
      d.concerns.includes('http') ||
      d.name.includes('http') ||
      d.name.includes('fetch') ||
      d.name.includes('axios') ||
      d.name.includes('request'),
  );

  if (hasHttpDeps) return true;

  const pathLower = module.path.toLowerCase();
  return CLIENT_DIR_PATTERNS.some((pattern) => pathLower.includes(pattern));
}
