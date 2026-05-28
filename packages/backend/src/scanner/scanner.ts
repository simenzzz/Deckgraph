/**
 * Project scanner: orchestrates discovery, manifest parsing, and graph building.
 *
 * Combines module discovery, adapter-based parsing, and graph construction
 * into a single scanProject() entry point.
 */

import type {
  AdapterRegistry,
  Project,
  ProjectConfig,
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
import { createScanProfiler } from '../profiler/scanProfiler.js';

const logger = createLogger('scanner');

/**
 * Options for scanning a project.
 */
export interface ScanOptions {
  /** Absolute path to the project root */
  readonly projectRoot: string;
  /** Absolute path to load .deckgraph.yaml from. Defaults to projectRoot. */
  readonly configRoot?: string;
  /** Repository-relative subdirectory to discover modules from. Defaults to project root. */
  readonly scanRoot?: string;
  /** Additional ignore paths merged with .deckgraph.yaml ignore-paths for this scan. */
  readonly additionalIgnorePaths?: readonly string[];
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
  const profiler = createScanProfiler();

  const config = await loadConfig(options.configRoot ?? projectRoot);
  const effectiveConfig = mergeScanConfig(config, options.additionalIgnorePaths ?? []);
  if (config) {
    logger.info('Config loaded from .deckgraph.yaml');
  }

  profiler.startPhase('discovery');
  const discovered = await discoverModules(projectRoot, effectiveConfig, {
    scanRoot: options.scanRoot,
  });
  profiler.endPhase('discovery');
  logger.info({ moduleCount: discovered.length }, 'Modules discovered');

  profiler.startPhase('manifestParsing');
  const rawModules = await buildModules(discovered, projectRoot, registry);
  profiler.endPhase('manifestParsing');

  const taggedModules = tagDependencies(rawModules, effectiveConfig);

  profiler.startPhase('graphBuild');
  const graph = buildGraph(taggedModules);
  profiler.endPhase('graphBuild');

  profiler.startPhase('crossLang');
  const crossEdges = await detectCrossEdges(projectRoot, taggedModules);
  profiler.endPhase('crossLang');

  const project: Project = {
    root: projectRoot,
    config: effectiveConfig,
    modules: taggedModules,
    crossEdges,
    lastScannedAt: new Date().toISOString(),
  };

  const timings = profiler.getTimings();
  logger.info(
    {
      moduleCount: taggedModules.length,
      depCount: countDeps(taggedModules),
      crossEdgeCount: crossEdges.length,
      ...timings,
    },
    'Scan complete',
  );

  return { project, graph: { ...graph, crossEdges } };
}

function mergeScanConfig(
  config: ProjectConfig | null,
  additionalIgnorePaths: readonly string[],
): ProjectConfig | null {
  if (additionalIgnorePaths.length === 0) return config;

  return {
    ignorePaths: [...(config?.ignorePaths ?? []), ...additionalIgnorePaths],
    concernOverrides: config?.concernOverrides ?? {},
  };
}
