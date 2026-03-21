/**
 * Build reference cross-language edge detector.
 *
 * Parses docker-compose.yml for build.context paths and Makefiles
 * for cross-module references.
 */

import type { CrossEdge, Module } from '@deckgraph/shared';
import { readFileSafe } from '../adapters/utils.js';
import { findFiles, findOwningModule } from './fileScanner.js';
import type { EdgeDetector } from './types.js';
import { createLogger } from '../logger.js';
import { join, normalize } from 'node:path';
import yaml from 'js-yaml';

const logger = createLogger('buildRefDetector');

const BUILD_FILE_PATTERNS = [
  '**/docker-compose.yml',
  '**/docker-compose.yaml',
  '**/docker-compose.*.yml',
  '**/docker-compose.*.yaml',
  '**/Makefile',
];

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function createBuildRefDetector(): EdgeDetector {
  return {
    name: 'build',

    async detect(
      projectRoot: string,
      modules: readonly Module[],
    ): Promise<readonly CrossEdge[]> {
      const buildFiles = await findFiles(projectRoot, BUILD_FILE_PATTERNS);
      if (buildFiles.length === 0) return [];

      logger.debug({ count: buildFiles.length }, 'Found build files');

      const allEdges: CrossEdge[] = [];

      for (const file of buildFiles) {
        const content = await readFileSafe(join(projectRoot, file));
        if (!content) continue;

        const edges = file.toLowerCase().includes('makefile')
          ? detectMakefileRefs(file, content, modules)
          : detectDockerComposeRefs(file, content, modules);

        allEdges.push(...edges);
      }

      return allEdges;
    },
  };
}

function detectDockerComposeRefs(
  filePath: string,
  content: string,
  modules: readonly Module[],
): readonly CrossEdge[] {
  let parsed: unknown;
  try {
    parsed = yaml.load(content, { schema: yaml.JSON_SCHEMA });
  } catch {
    logger.warn({ filePath }, 'Failed to parse docker-compose file');
    return [];
  }

  if (!parsed || typeof parsed !== 'object') return [];

  const compose = parsed as Record<string, unknown>;
  const services = compose['services'] as Record<string, unknown> | undefined;
  if (!services) return [];

  const edges: CrossEdge[] = [];
  const fileDir = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '.';
  const referencedPaths = new Set<string>();

  for (const [, serviceDef] of Object.entries(services)) {
    if (!serviceDef || typeof serviceDef !== 'object') continue;

    const service = serviceDef as Record<string, unknown>;
    const buildConfig = service['build'];

    let contextPath: string | null = null;
    if (typeof buildConfig === 'string') {
      contextPath = buildConfig;
    } else if (buildConfig && typeof buildConfig === 'object') {
      const build = buildConfig as Record<string, unknown>;
      if (typeof build['context'] === 'string') {
        contextPath = build['context'];
      }
    }

    if (contextPath) {
      const normalized = normalize(
        fileDir === '.' ? contextPath : `${fileDir}/${contextPath}`,
      );
      referencedPaths.add(normalized);
    }
  }

  const composeModule = findOwningModule(filePath, modules);
  const modulePaths = new Set(modules.map((m) => m.path));

  for (const refPath of referencedPaths) {
    if (!modulePaths.has(refPath)) continue;

    const targetModule = modules.find((m) => m.path === refPath);
    if (!targetModule) continue;

    const sourceModule = composeModule;
    if (!sourceModule || sourceModule.path === targetModule.path) continue;
    if (sourceModule.ecosystem === targetModule.ecosystem) continue;

    edges.push({
      from: { module: sourceModule.path, ecosystem: sourceModule.ecosystem },
      to: { module: targetModule.path, ecosystem: targetModule.ecosystem },
      type: 'build',
      evidence: `docker-compose.yml references build context ${refPath}`,
      confidence: 0.4,
    });
  }

  return edges;
}

function detectMakefileRefs(
  filePath: string,
  content: string,
  modules: readonly Module[],
): readonly CrossEdge[] {
  const edges: CrossEdge[] = [];
  const sourceModule = findOwningModule(filePath, modules);
  if (!sourceModule) return [];

  for (const targetModule of modules) {
    if (targetModule.path === sourceModule.path) continue;
    if (targetModule.path === '.') continue;
    if (targetModule.ecosystem === sourceModule.ecosystem) continue;

    // Use word-boundary matching to avoid substring false positives
    const pathRegex = new RegExp(
      `(?:^|[\\s/])${escapeRegex(targetModule.path)}(?:[\\s/]|$)`,
      'm',
    );
    if (pathRegex.test(content)) {
      edges.push({
        from: { module: sourceModule.path, ecosystem: sourceModule.ecosystem },
        to: { module: targetModule.path, ecosystem: targetModule.ecosystem },
        type: 'build',
        evidence: `Makefile in ${sourceModule.path} references ${targetModule.path}`,
        confidence: 0.4,
      });
    }
  }

  return edges;
}
