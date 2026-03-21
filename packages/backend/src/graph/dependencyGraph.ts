/**
 * Unified dependency graph construction.
 *
 * Builds a DAG from modules and their dependencies using adjacency lists.
 * All functions are pure — they return new graphs, never mutate.
 */

import type { Ecosystem, Module, UnifiedGraph } from '@deckgraph/shared';

/**
 * Build a canonical key for a dependency node.
 * Format: "ecosystem:packageName" (e.g. "npm:react").
 */
export function depKey(ecosystem: Ecosystem, name: string): string {
  return `${ecosystem}:${name}`;
}

/**
 * Create an empty unified graph with no modules or edges.
 */
export function emptyGraph(): UnifiedGraph {
  return {
    modules: new Map(),
    forward: new Map(),
    reverse: new Map(),
    crossEdges: [],
  };
}

/**
 * Build a unified graph from an array of modules.
 *
 * For each module, creates forward edges from the module path to each
 * dependency key, and reverse edges from each dependency key back to
 * the module path.
 */
export function buildGraph(modules: readonly Module[]): UnifiedGraph {
  const moduleMap = new Map<string, Module>();
  const forward = new Map<string, Set<string>>();
  const reverse = new Map<string, Set<string>>();

  for (const mod of modules) {
    moduleMap.set(mod.path, mod);

    const deps = new Set<string>();
    for (const dep of mod.dependencies) {
      const key = depKey(dep.ecosystem, dep.name);
      deps.add(key);

      const existing = reverse.get(key);
      if (existing) {
        existing.add(mod.path);
      } else {
        reverse.set(key, new Set([mod.path]));
      }
    }

    forward.set(mod.path, deps);
  }

  return {
    modules: moduleMap as ReadonlyMap<string, Module>,
    forward: forward as ReadonlyMap<string, ReadonlySet<string>>,
    reverse: reverse as ReadonlyMap<string, ReadonlySet<string>>,
    crossEdges: [],
  };
}

/**
 * Return a new graph with the given module added (or replaced if path exists).
 * Preserves existing crossEdges.
 */
export function addModule(graph: UnifiedGraph, module: Module): UnifiedGraph {
  // Remove old version first (cleans up stale edges), then build fresh
  const cleaned = graph.modules.has(module.path)
    ? removeModule(graph, module.path)
    : graph;

  const existingModules = [...cleaned.modules.values()];
  const rebuilt = buildGraph([...existingModules, module]);
  return { ...rebuilt, crossEdges: cleaned.crossEdges };
}

/**
 * Return a new graph with the module at the given path removed.
 * If the path doesn't exist, returns the graph unchanged.
 * Preserves existing crossEdges.
 */
export function removeModule(graph: UnifiedGraph, modulePath: string): UnifiedGraph {
  if (!graph.modules.has(modulePath)) {
    return graph;
  }

  const remainingModules = [...graph.modules.values()].filter(
    (m) => m.path !== modulePath,
  );

  const rebuilt = buildGraph(remainingModules);
  return { ...rebuilt, crossEdges: graph.crossEdges };
}
