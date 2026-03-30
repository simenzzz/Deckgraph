/**
 * Workspace-level graph analysis.
 *
 * Detects cross-root dependency divergence - when the same package
 * is used in multiple projects at different versions.
 */

import type {
  Ecosystem,
  Project,
  CrossRootDependency,
  CrossRootVersion,
} from '@deckgraph/shared';
import { createLogger } from '../logger.js';

const logger = createLogger('workspaceGraph');

/**
 * Internal representation of a dependency usage across projects.
 */
interface DepUsage {
  readonly ecosystem: Ecosystem;
  readonly packageName: string;
  readonly versions: Map<string, readonly CrossRootVersion[]>;
}

/**
 * Detect cross-root dependency divergence across all projects.
 *
 * A dependency is considered divergent if:
 * - The same package (ecosystem + name) appears in multiple projects
 * - It has different version constraints in different projects
 *
 * Pure function - no side effects.
 */
export function detectCrossRootDeps(
  projects: readonly Project[],
): readonly CrossRootDependency[] {
  const usageMap = new Map<string, DepUsage>();

  // Collect all dependency usages across all projects
  for (const project of projects) {
    for (const module of project.modules) {
      for (const dep of module.dependencies) {
        const key = `${dep.ecosystem}:${dep.name}`;

        let usage = usageMap.get(key);
        if (!usage) {
          usage = {
            ecosystem: dep.ecosystem,
            packageName: dep.name,
            versions: new Map(),
          };
          usageMap.set(key, usage);
        }

        const versionKey = dep.version;
        const existing = usage.versions.get(versionKey) ?? [];
        usage.versions.set(versionKey, [
          ...existing,
          {
            projectRoot: project.root,
            modulePath: module.path,
            version: dep.version,
            constraint: dep.constraint,
          },
        ]);
      }
    }
  }

  // Filter to only dependencies with multiple versions
  const divergent: CrossRootDependency[] = [];

  for (const usage of usageMap.values()) {
    if (usage.versions.size > 1) {
      const versions: CrossRootVersion[] = [];

      for (const versionList of usage.versions.values()) {
        versions.push(...versionList);
      }

      divergent.push({
        ecosystem: usage.ecosystem,
        packageName: usage.packageName,
        versions,
      });
    }
  }

  if (divergent.length > 0) {
    logger.info(
      { divergentCount: divergent.length },
      'Cross-root dependency divergence detected',
    );
  }

  return divergent;
}
