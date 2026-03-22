/**
 * View system types.
 *
 * The view system prevents "hairball" displays by ensuring the UI
 * never sees the raw dependency graph. Every UI render is driven by
 * a ViewQuery → ViewResult cycle through the backend's query engine.
 */

import type {
  AnalysisState,
  CrossEdge,
  CrossEdgeType,
  Dependency,
  DependencyScope,
  Ecosystem,
} from './project.js';

/**
 * All filters are optional. Omitting a filter means "no constraint on that axis."
 */
export interface ViewQuery {
  /** Filter to specific ecosystems (e.g. ["npm", "pypi"]) */
  readonly ecosystems?: readonly Ecosystem[];

  /** Filter to specific modules by path (e.g. ["services/auth", "libs/shared"]) */
  readonly modules?: readonly string[];

  /** Filter to specific dependency scopes */
  readonly scopes?: readonly DependencyScope[];

  /**
   * Transitive depth limit.
   * depth=1 means direct dependencies only.
   * depth=N means include transitive dependencies up to N hops.
   * depth=undefined means no transitive expansion (direct deps only, same as depth=1).
   */
  readonly depth?: number;

  /** Filter to dependencies tagged with this concern (e.g. "http", "database") */
  readonly concern?: string;

  /** Fuzzy name search across dependencies */
  readonly search?: string;

  /** Include cross-language edges in the result */
  readonly showCrossEdges?: boolean;

  /** Which cross-language edge types to include (default: proto, ffi, openapi) */
  readonly crossEdgeTypes?: readonly CrossEdgeType[];

  /** How deeply each module should be analyzed before returning */
  readonly analysisLevel?: 'manifest' | 'imports' | 'registry';
}

/**
 * The filtered projection of the unified graph.
 * This is what the UI renders.
 */
export interface ViewResult {
  /** Modules matching the query, with their filtered dependencies */
  readonly modules: readonly ModuleView[];

  /** Cross-language edges matching the query (empty if showCrossEdges is false) */
  readonly crossEdges: readonly CrossEdge[];

  /** Aggregate summary for the filtered result set */
  readonly summary: ViewSummary;
}

/**
 * A module as seen through the current query filters.
 */
export interface ModuleView {
  /** Module path (relative to project root) */
  readonly path: string;
  /** Module name */
  readonly name: string;
  /** Ecosystem */
  readonly ecosystem: Ecosystem;
  /** Current analysis state */
  readonly analysisState: AnalysisState;
  /** Dependencies matching the query filters */
  readonly dependencies: readonly Dependency[];
  /** Count of total deps (before filtering) for context */
  readonly totalDependencyCount: number;
}

/**
 * How far behind a dependency is from its latest version.
 */
export type OutdatedSeverity =
  | 'up-to-date'
  | 'patch-behind'
  | 'minor-behind'
  | 'major-behind';

/**
 * Aggregate counts for the filtered result set.
 * Displayed in overview cards and filter badges.
 */
export interface ViewSummary {
  /** Total dependencies in the filtered view */
  readonly totalDeps: number;
  /** Breakdown by ecosystem */
  readonly byEcosystem: Readonly<Record<Ecosystem, number>>;
  /** Breakdown by scope */
  readonly byScope: Readonly<Record<DependencyScope, number>>;
  /** Number of outdated deps (only if registry-enriched) */
  readonly outdatedCount: number | null;
  /** Number of unused deps (only if imports-resolved) */
  readonly unusedCount: number | null;
  /** Number of modules in the view */
  readonly moduleCount: number;
  /** Number of cross-language edges in the view */
  readonly crossEdgeCount: number;
}
