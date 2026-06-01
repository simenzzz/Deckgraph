/**
 * Cross-language edge detection aggregator.
 *
 * Runs all 5 detectors in parallel, deduplicates edges,
 * and validates each edge with Zod.
 */

import type { CrossEdge, Module } from '@deckgraph/shared';
import { crossEdgeSchema } from '@deckgraph/shared';
import { createProtoDetector } from './protoDetector.js';
import { createFfiDetector } from './ffiDetector.js';
import { createOpenapiDetector } from './openapiDetector.js';
import { createBuildRefDetector } from './buildRefDetector.js';
import { createSharedConfigDetector } from './sharedConfigDetector.js';
import type { EdgeDetector } from './types.js';
import { createLogger } from '../logger.js';

const logger = createLogger('crosslang');

function createDetectors(): readonly EdgeDetector[] {
  return [
    createProtoDetector(),
    createFfiDetector(),
    createOpenapiDetector(),
    createBuildRefDetector(),
    createSharedConfigDetector(),
  ];
}

/**
 * Detect all cross-language edges in the project.
 *
 * Runs all detectors in parallel, deduplicates edges (same from/to/type
 * keeps highest confidence), and validates each edge with Zod.
 */
export async function detectCrossEdges(
  projectRoot: string,
  modules: readonly Module[],
): Promise<readonly CrossEdge[]> {
  if (modules.length < 2) return [];

  const detectors = createDetectors();

  const results = await Promise.all(
    detectors.map(async (detector) => {
      try {
        const edges = await detector.detect(projectRoot, modules);
        logger.debug(
          { detector: detector.name, edgeCount: edges.length },
          'Detector completed',
        );
        return edges;
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'unknown error';
        logger.error(
          { detector: detector.name, error: detail },
          'Detector failed — skipping',
        );
        return [] as readonly CrossEdge[];
      }
    }),
  );

  const allEdges = results.flat();
  const deduped = deduplicateEdges(allEdges);
  const validated = validateEdges(deduped);

  logger.info(
    { total: allEdges.length, deduped: deduped.length, valid: validated.length },
    'Cross-language edge detection complete',
  );

  return validated;
}

/**
 * Deduplicate edges: same from/to/type keeps highest confidence.
 */
function deduplicateEdges(edges: readonly CrossEdge[]): readonly CrossEdge[] {
  const map = new Map<string, CrossEdge>();

  for (const edge of edges) {
    const key = `${edge.from.module}|${edge.to.module}|${edge.type}`;
    const existing = map.get(key);

    if (!existing || edge.confidence > existing.confidence) {
      map.set(key, edge);
    }
  }

  return [...map.values()];
}

/**
 * Validate each edge with Zod. Logs and skips invalid edges.
 */
function validateEdges(edges: readonly CrossEdge[]): readonly CrossEdge[] {
  const valid: CrossEdge[] = [];

  for (const edge of edges) {
    const result = crossEdgeSchema.safeParse(edge);
    if (result.success) {
      valid.push(edge);
    } else {
      logger.warn(
        { edge, issues: result.error.issues },
        'Invalid cross-edge — skipping',
      );
    }
  }

  return valid;
}

export type { EdgeDetector } from './types.js';
