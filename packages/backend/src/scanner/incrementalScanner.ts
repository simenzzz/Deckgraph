/**
 * Incremental scanner: re-scans only affected modules after file changes.
 *
 * Given a FileChangeEvent and previous ScanResult, produces a new ScanResult
 * by re-parsing only changed modules and merging with unchanged data.
 */

import type { AdapterRegistry, Dependency, Module } from '@deckgraph/shared';
import { loadConfig } from '../config/configLoader.js';
import { discoverModules } from '../discovery/moduleDiscovery.js';
import { createDefaultRegistry } from '../adapters/index.js';
import { buildGraph } from '../graph/dependencyGraph.js';
import { tagDependencies } from '../concern/index.js';
import { detectCrossEdges } from '../crosslang/index.js';
import { createLogger } from '../logger.js';
import { buildModules, countDeps } from './helpers.js';
import type { ScanResult } from './scanner.js';
import type { FileChangeEvent } from '../watcher/fileWatcher.js';

const logger = createLogger('incrementalScanner');

/**
 * Build a fingerprint string for a module's dependencies.
 * Used to detect whether dependencies actually changed during incremental scan.
 */
function depFingerprint(deps: readonly Dependency[]): string {
  return deps
    .map((d) => `${d.name}@${d.version}:${d.constraint}:${d.scope}`)
    .sort()
    .join('|');
}

function fileBelongsToModule(filePath: string, modulePath: string): boolean {
  if (modulePath === '.') return true;
  return filePath === modulePath || filePath.startsWith(`${modulePath}/`);
}

function manifestPathSet(modulePath: string, manifests: readonly string[]): Set<string> {
  const paths = new Set<string>();
  for (const manifest of manifests) {
    paths.add(manifest);
    paths.add(`${modulePath}/${manifest}`);
  }
  return paths;
}

function hasSourceFileChange(
  modulePath: string,
  manifests: readonly string[],
  event: FileChangeEvent,
): boolean {
  const manifestPaths = manifestPathSet(modulePath, manifests);
  const changedFiles = [
    ...event.changedFiles,
    ...event.addedFiles,
    ...event.removedFiles,
  ];

  return changedFiles.some((filePath) =>
    fileBelongsToModule(filePath, modulePath) && !manifestPaths.has(filePath),
  );
}

/**
 * Options for incremental scanning.
 */
export interface IncrementalScanOptions {
  readonly projectRoot: string;
  readonly previousResult: ScanResult;
  readonly event: FileChangeEvent;
  readonly registry?: AdapterRegistry;
}

/**
 * Perform an incremental scan of the project.
 *
 * Flow:
 * 1. Re-discover modules (new manifests may have appeared)
 * 2. Identify affected modules from the event
 * 3. Re-parse manifests for affected modules only
 * 4. Merge updated modules with unchanged modules from previous result
 * 5. Rebuild graph and cross-language edges
 * 6. Return new immutable ScanResult
 */
export async function incrementalScan(
  options: IncrementalScanOptions,
): Promise<ScanResult> {
  const { projectRoot, previousResult, event } = options;
  const registry = options.registry ?? createDefaultRegistry();

  logger.info(
    {
      changed: event.changedFiles.length,
      added: event.addedFiles.length,
      removed: event.removedFiles.length,
      affectedModules: event.affectedModules.length,
    },
    'Starting incremental scan',
  );

  const config = await loadConfig(projectRoot);

  // Re-discover to detect new/removed modules
  const discovered = await discoverModules(projectRoot, config);

  const affectedPaths = new Set(event.affectedModules);
  const hasStructuralChanges =
    event.addedFiles.length > 0 || event.removedFiles.length > 0;

  // Determine which discovered modules need re-parsing
  const toReparse = discovered.filter(
    (disc) => affectedPaths.has(disc.path) || hasStructuralChanges,
  );

  const freshModules = await buildModules(toReparse, projectRoot, registry);
  const freshPaths = new Set(freshModules.map((m) => m.path));

  // Merge: use fresh modules for re-parsed paths, keep previous for unchanged
  const discoveredPaths = new Set(discovered.map((d) => d.path));
  const previousModules = previousResult.project.modules;

  const mergedModules: Module[] = [];

  // Add re-parsed modules, preserving analysisState if deps are unchanged
  const previousByPath = new Map(previousModules.map((m) => [m.path, m]));

  for (const mod of freshModules) {
    const prevMod = previousByPath.get(mod.path);
    const depsChanged =
      !prevMod || depFingerprint(prevMod.dependencies) !== depFingerprint(mod.dependencies);
    const sourceChanged = hasSourceFileChange(
      mod.path,
      [...mod.manifests, ...(prevMod?.manifests ?? [])],
      event,
    );

    mergedModules.push({
      ...mod,
      analysisState:
        depsChanged || sourceChanged ? 'manifest-only' : prevMod?.analysisState ?? 'manifest-only',
    });
  }

  // Keep unchanged modules from previous result (if they still exist)
  for (const mod of previousModules) {
    if (!freshPaths.has(mod.path) && discoveredPaths.has(mod.path)) {
      mergedModules.push(mod);
    }
  }

  const taggedModules = tagDependencies(mergedModules, config);
  const graph = buildGraph(taggedModules);
  const crossEdges = await detectCrossEdges(projectRoot, taggedModules);

  const project = {
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
      reparsed: freshModules.length,
    },
    'Incremental scan complete',
  );

  return { project, graph: { ...graph, crossEdges } };
}
