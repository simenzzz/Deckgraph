/**
 * Workspace scanner: orchestrates scanning of multiple project roots.
 *
 * Scans each root independently using the existing scanProject() function,
 * then aggregates results and detects cross-root dependency divergence.
 */

import type { Workspace, Project, WorkspaceConfig } from '@deckgraph/shared';
import { scanProject, type ScanResult } from './scanner.js';
import { detectCrossRootDeps } from '../graph/workspaceGraph.js';
import { createLogger } from '../logger.js';
import type { ResolvedRoot } from '../discovery/workspaceDiscovery.js';

const logger = createLogger('workspaceScanner');

/**
 * Options for scanning a workspace.
 */
export interface WorkspaceScanOptions {
  /** Resolved workspace root paths */
  readonly roots: readonly ResolvedRoot[];
  /** Workspace-level config */
  readonly config: WorkspaceConfig | null;
  /** Custom scanProject function (for testing) */
  readonly scanProjectFn?: typeof scanProject;
}

/**
 * Result of scanning a workspace.
 */
export interface WorkspaceScanResult {
  /** The aggregated workspace */
  readonly workspace: Workspace;
  /** Individual project scan results keyed by absolute root path */
  readonly projectResults: ReadonlyMap<string, ScanResult>;
}

/**
 * Scan all workspace roots and aggregate results.
 *
 * Flow:
 * 1. Scan each root using scanProject()
 * 2. Detect cross-root dependency divergence
 * 3. Build aggregated Workspace object
 *
 * @throws Error if any root scan fails
 */
export async function scanWorkspace(
  options: WorkspaceScanOptions,
): Promise<WorkspaceScanResult> {
  const { roots, config, scanProjectFn = scanProject } = options;

  logger.info({ rootCount: roots.length }, 'Starting workspace scan');

  const projectResults = new Map<string, ScanResult>();
  const projects: Project[] = [];

  // Scan each root in parallel
  const scanPromises = roots.map(async (root) => {
    logger.debug({ root: root.absolutePath }, 'Scanning workspace root');

    const result = await scanProjectFn({
      projectRoot: root.absolutePath,
    });

    return { root, result };
  });

  const scanned = await Promise.all(scanPromises);

  for (const { root, result } of scanned) {
    projectResults.set(root.absolutePath, result);
    projects.push(result.project);
  }

  // Detect cross-root dependency divergence
  const crossRootDeps = detectCrossRootDeps(projects);

  const workspace: Workspace = {
    projects,
    config,
    crossRootDeps,
    lastScannedAt: new Date().toISOString(),
  };

  logger.info(
    {
      projectCount: projects.length,
      crossRootDepCount: crossRootDeps.length,
    },
    'Workspace scan complete',
  );

  return { workspace, projectResults };
}
