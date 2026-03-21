/**
 * Project scanner: orchestrates discovery, manifest parsing, and graph building.
 *
 * Combines module discovery, adapter-based parsing, and graph construction
 * into a single scanProject() entry point.
 */

import type {
  AdapterRegistry,
  Dependency,
  EcosystemAdapter,
  Ecosystem,
  ManifestResult,
  MinimalDependency,
  Module,
  Project,
  UnifiedGraph,
} from '@deckgraph/shared';
import { loadConfig } from '../config/configLoader.js';
import { discoverModules } from '../discovery/moduleDiscovery.js';
import type { DiscoveredModule } from '../discovery/moduleDiscovery.js';
import { createDefaultRegistry } from '../adapters/index.js';
import { buildGraph } from '../graph/dependencyGraph.js';
import { createLogger } from '../logger.js';

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

  const modules = await buildModules(discovered, projectRoot, registry);
  const graph = buildGraph(modules);

  const project: Project = {
    root: projectRoot,
    config,
    modules,
    crossEdges: [],
    lastScannedAt: new Date().toISOString(),
  };

  logger.info(
    { moduleCount: modules.length, depCount: countDeps(modules) },
    'Scan complete',
  );

  return { project, graph };
}

/**
 * Parse manifests for all discovered modules and convert to full Module objects.
 * Skips modules with no adapter or adapter errors.
 */
async function buildModules(
  discovered: readonly DiscoveredModule[],
  projectRoot: string,
  registry: AdapterRegistry,
): Promise<readonly Module[]> {
  const modules: Module[] = [];

  for (const disc of discovered) {
    const adapter = findAdapter(disc, registry);
    if (!adapter) {
      logger.warn(
        { path: disc.path, ecosystem: disc.ecosystem },
        'No adapter registered — skipping module',
      );
      continue;
    }

    try {
      const manifest = await adapter.parseManifests(projectRoot, disc.path);
      const mod = buildModule(disc, manifest);
      modules.push(mod);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'unknown error';
      logger.error(
        { path: disc.path, error: detail },
        'Manifest parsing failed — skipping module',
      );
    }
  }

  return modules;
}

/**
 * Find the adapter for a discovered module by checking its manifest files.
 */
function findAdapter(
  disc: DiscoveredModule,
  registry: AdapterRegistry,
): EcosystemAdapter | null {
  for (const manifest of disc.manifests) {
    const adapter = registry.getAdapterForManifest(manifest);
    if (adapter) return adapter;
  }
  return null;
}

/**
 * Convert a DiscoveredModule + ManifestResult into a full Module.
 */
function buildModule(
  disc: DiscoveredModule,
  manifest: ManifestResult,
): Module {
  return {
    path: disc.path,
    name: manifest.moduleName,
    ecosystem: disc.ecosystem,
    manifests: [...disc.manifests],
    dependencies: manifest.dependencies.map((d) =>
      toFullDependency(d, disc.ecosystem),
    ),
    analysisState: 'manifest-only',
  };
}

/**
 * Convert a MinimalDependency (from adapter) into a full Dependency.
 * Fills in Phase 1 defaults for lazy fields.
 */
function toFullDependency(
  minimal: MinimalDependency,
  ecosystem: Ecosystem,
): Dependency {
  return {
    name: minimal.name,
    ecosystem,
    version: minimal.version,
    constraint: minimal.constraint,
    scope: minimal.scope,
    source: 'manifest',
    concerns: [],
    usedInFiles: null,
    transitiveDeps: null,
    registryMeta: null,
  };
}

/**
 * Count total dependencies across all modules.
 */
function countDeps(modules: readonly Module[]): number {
  let count = 0;
  for (const mod of modules) {
    count += mod.dependencies.length;
  }
  return count;
}
