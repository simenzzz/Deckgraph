/**
 * Query engine for filtering the unified graph.
 *
 * Translates ViewQuery into ViewResult by filtering modules, dependencies,
 * and cross-language edges. The UI never sees the raw graph.
 */

import Fuse from 'fuse.js';
import type {
  CrossEdge,
  CrossEdgeType,
  Dependency,
  DependencyScope,
  Ecosystem,
  Module,
  ModuleView,
  UnifiedGraph,
  ViewQuery,
  ViewResult,
  ViewSummary,
} from '@deckgraph/shared';

/** Default cross-edge types shown when showCrossEdges is true but no types specified */
const DEFAULT_CROSS_EDGE_TYPES: readonly CrossEdgeType[] = ['proto', 'ffi', 'openapi'];

/** Fuse.js search threshold (0 = exact, 1 = anything) */
const SEARCH_THRESHOLD = 0.4;

/**
 * WeakMap-based summary cache for unfiltered queries.
 * Keyed on the graph reference — auto-invalidated when graph is replaced
 * after incremental scan. Only caches summaries for empty queries.
 */
const summaryCache = new WeakMap<UnifiedGraph, ViewSummary>();

/**
 * Execute a view query against the unified graph.
 *
 * Pipeline:
 * 1. Filter modules by ecosystem and path
 * 2. Per module, filter deps by scope, concern, and search
 * 3. Exclude modules with 0 filtered deps (when dep-level filters active)
 * 4. Filter cross-edges by endpoint inclusion and type
 * 5. Build ModuleView[] and compute ViewSummary
 */
export function executeQuery(graph: UnifiedGraph, query: ViewQuery): ViewResult {
  const hasDepFilters = hasActiveDependencyFilters(query);
  const isUnfiltered = !hasDepFilters && !query.ecosystems && !query.modules;

  // For unfiltered queries, try the WeakMap summary cache
  if (isUnfiltered) {
    const cached = summaryCache.get(graph);
    if (cached) {
      // Rebuild moduleViews and crossEdges (cheap) but reuse cached summary
      const moduleViews = buildAllModuleViews(graph);
      const filteredCrossEdges = filterCrossEdges(
        graph.crossEdges,
        moduleViews,
        query,
      );
      return {
        modules: moduleViews,
        crossEdges: filteredCrossEdges,
        summary: cached,
      };
    }
  }

  const moduleViews: ModuleView[] = [];

  for (const [, module] of graph.modules) {
    if (!matchesModuleFilters(module, query)) continue;

    const filteredDeps = filterDependencies(module.dependencies, query);

    // Skip modules with no matching deps when dep-level filters are active
    if (hasDepFilters && filteredDeps.length === 0) continue;

    moduleViews.push({
      path: module.path,
      name: module.name,
      ecosystem: module.ecosystem,
      analysisState: module.analysisState,
      dependencies: filteredDeps,
      totalDependencyCount: module.dependencies.length,
    });
  }

  const filteredCrossEdges = filterCrossEdges(
    graph.crossEdges,
    moduleViews,
    query,
  );

  const summary = buildSummary(moduleViews, filteredCrossEdges);

  // Cache summary for unfiltered queries
  if (isUnfiltered) {
    summaryCache.set(graph, summary);
  }

  return {
    modules: moduleViews,
    crossEdges: filteredCrossEdges,
    summary,
  };
}

/**
 * Build module views for all modules (no filtering).
 * Used when serving cached summary for unfiltered queries.
 */
function buildAllModuleViews(graph: UnifiedGraph): ModuleView[] {
  const moduleViews: ModuleView[] = [];
  for (const [, module] of graph.modules) {
    moduleViews.push({
      path: module.path,
      name: module.name,
      ecosystem: module.ecosystem,
      analysisState: module.analysisState,
      dependencies: module.dependencies,
      totalDependencyCount: module.dependencies.length,
    });
  }
  return moduleViews;
}

/**
 * Check if the query has any dependency-level filters active.
 */
function hasActiveDependencyFilters(query: ViewQuery): boolean {
  return !!(
    (query.scopes && query.scopes.length > 0) ||
    query.concern ||
    query.search
  );
}

/**
 * Check if a module matches the module-level filters (ecosystem, path).
 */
function matchesModuleFilters(module: Module, query: ViewQuery): boolean {
  if (query.ecosystems && query.ecosystems.length > 0) {
    if (!query.ecosystems.includes(module.ecosystem)) return false;
  }

  if (query.modules && query.modules.length > 0) {
    if (!query.modules.includes(module.path)) return false;
  }

  return true;
}

/**
 * Filter a module's dependencies by scope, concern, and search.
 */
function filterDependencies(
  deps: readonly Dependency[],
  query: ViewQuery,
): readonly Dependency[] {
  let filtered = [...deps];

  // Filter by scope
  if (query.scopes && query.scopes.length > 0) {
    const scopeSet = new Set<DependencyScope>(query.scopes);
    filtered = filtered.filter((d) => scopeSet.has(d.scope));
  }

  // Filter by concern tag
  if (query.concern) {
    const concern = query.concern;
    filtered = filtered.filter((d) => d.concerns.includes(concern));
  }

  // Fuzzy search by name
  if (query.search && query.search.length > 0) {
    filtered = fuzzySearchDeps(filtered, query.search);
  }

  return filtered;
}

/**
 * Fuzzy search dependencies by name using Fuse.js.
 */
function fuzzySearchDeps(
  deps: readonly Dependency[],
  search: string,
): Dependency[] {
  const fuse = new Fuse([...deps], {
    keys: ['name'],
    threshold: SEARCH_THRESHOLD,
  });

  return fuse.search(search).map((result) => result.item);
}

/**
 * Filter cross-edges: keep only edges where both endpoints are in the
 * filtered module view and edge type is included.
 */
function filterCrossEdges(
  crossEdges: readonly CrossEdge[],
  moduleViews: readonly ModuleView[],
  query: ViewQuery,
): readonly CrossEdge[] {
  if (!query.showCrossEdges) return [];

  const modulePaths = new Set(moduleViews.map((m) => m.path));
  const allowedTypes = new Set<CrossEdgeType>(
    query.crossEdgeTypes && query.crossEdgeTypes.length > 0
      ? query.crossEdgeTypes
      : DEFAULT_CROSS_EDGE_TYPES,
  );

  return crossEdges.filter(
    (edge) =>
      modulePaths.has(edge.from.module) &&
      modulePaths.has(edge.to.module) &&
      allowedTypes.has(edge.type),
  );
}

/**
 * Compute a ViewSummary from the filtered module views and cross-edges.
 */
function buildSummary(
  moduleViews: readonly ModuleView[],
  crossEdges: readonly CrossEdge[],
): ViewSummary {
  const byEcosystem: Record<Ecosystem, number> = {
    npm: 0,
    pypi: 0,
    cargo: 0,
    go: 0,
    maven: 0,
  };

  const byScope: Record<DependencyScope, number> = {
    runtime: 0,
    dev: 0,
    build: 0,
    optional: 0,
    peer: 0,
  };

  let totalDeps = 0;

  for (const mod of moduleViews) {
    for (const dep of mod.dependencies) {
      totalDeps++;
      byEcosystem[dep.ecosystem]++;
      byScope[dep.scope]++;
    }
  }

  return {
    totalDeps,
    byEcosystem,
    byScope,
    outdatedCount: null,
    unusedCount: null,
    moduleCount: moduleViews.length,
    crossEdgeCount: crossEdges.length,
  };
}
