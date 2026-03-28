/**
 * Project scanner: orchestrates discovery, manifest parsing, and graph building.
 *
 * Combines module discovery, adapter-based parsing, and graph construction
 * into a single scanProject() entry point.
 */

import type {
  AdapterRegistry,
  Project,
  UnifiedGraph,
} from '@deckgraph/shared';
import { loadConfig } from '../config/configLoader.js';
import { discoverModules } from '../discovery/moduleDiscovery.js';
import { createDefaultRegistry } from '../adapters/index.js';
import { buildGraph } from '../graph/dependencyGraph.js';
import { tagDependencies } from '../concern/index.js';
import { detectCrossEdges } from '../crosslang/index.js';
import { createLogger } from '../logger.js';
import { buildModules, countDeps } from './helpers.js';

const logger = createLogger('scanner');

/**
 * Options for scanning a project.
 */
export interface ScanOptions {
  /** Absolute path to the project root */
  readonly projectRoot: string;
  /** Custom adapter registry (for testing) */
  readonly registry?: AdapterRegistry;
}

/**
 * Result of scanning a project.
 */
export interface ScanResult {
  /** The scanned project metadata */
  readonly project: Project;
  /** The unified dependency graph */
  readonly graph: UnifiedGraph;
}

/**
 * Scan a project: discover modules, parse manifests, build graph.
 *
 * Flow:
 * 1. Load config from .deckgraph.yaml
 * 2. Discover modules via filesystem scan
 * 3. For each module: find adapter, parse manifests, build Module
 * 4. Build unified dependency graph
 * 5. Return Project + UnifiedGraph
 */
export async function scanProject(options: ScanOptions): Promise<ScanResult> {
  const { projectRoot } = options;
  const registry = options.registry ?? createDefaultRegistry();

  const config = await loadConfig(projectRoot);
  if (config) {
    logger.info('Config loaded from .deckgraph.yaml');
  }

  const discovered = await discoverModules(projectRoot, config);
  logger.info({ moduleCount: discovered.length }, 'Modules discovered');

  const rawModules = await buildModules(discovered, projectRoot, registry);
  const taggedModules = tagDependencies(rawModules, config);
  const graph = buildGraph(taggedModules);
  const crossEdges = await detectCrossEdges(projectRoot, taggedModules);

  const project: Project = {
    root: projectRoot,
    config,
    modules: taggedModules,
    crossEdges,
    lastScannedAt: new Date().toISOString(),
  };

  logger.info(
    {
      moduleCount: taggedModules.length,
      depCount: countDeps(taggedModules),
      crossEdgeCount: crossEdges.length,
    },
    'Scan complete',
  );

  return { project, graph: { ...graph, crossEdges } };
}
