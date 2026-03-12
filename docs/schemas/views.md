# View Schema

> **Canonical source:** `packages/shared/src/types/views.ts`
> **Last verified:** Pre-implementation (schema designed, not yet coded)

The view system prevents "hairball" displays by ensuring the UI never sees the raw dependency graph. Every UI render is driven by a `ViewQuery` → `ViewResult` cycle through the backend's query engine.

## ViewQuery

All filters are optional. Omitting a filter means "no constraint on that axis."

```typescript
interface ViewQuery {
  /** Filter to specific ecosystems (e.g. ["npm", "pypi"]) */
  readonly ecosystems?: readonly Ecosystem[]

  /** Filter to specific modules by path (e.g. ["services/auth", "libs/shared"]) */
  readonly modules?: readonly string[]

  /** Filter to specific dependency scopes */
  readonly scopes?: readonly DependencyScope[]

  /**
   * Transitive depth limit.
   * depth=1 means direct dependencies only.
   * depth=N means include transitive dependencies up to N hops.
   * depth=undefined means no transitive expansion (direct deps only, same as depth=1).
   */
  readonly depth?: number

  /** Filter to dependencies tagged with this concern (e.g. "http", "database") */
  readonly concern?: string

  /** Fuzzy name search across dependencies */
  readonly search?: string

  /** Include cross-language edges in the result */
  readonly showCrossEdges?: boolean

  /** Which cross-language edge types to include (default: proto, ffi, openapi) */
  readonly crossEdgeTypes?: readonly CrossEdgeType[]

  /** How deeply each module should be analyzed before returning */
  readonly analysisLevel?: "manifest" | "imports" | "registry"
}
```

## ViewResult

The filtered projection of the unified graph. This is what the UI renders.

```typescript
interface ViewResult {
  /** Modules matching the query, with their filtered dependencies */
  readonly modules: readonly ModuleView[]

  /** Cross-language edges matching the query (empty if showCrossEdges is false) */
  readonly crossEdges: readonly CrossEdge[]

  /** Aggregate summary for the filtered result set */
  readonly summary: ViewSummary
}
```

## ModuleView

A module as seen through the current query filters.

```typescript
interface ModuleView {
  /** Module path (relative to project root) */
  readonly path: string
  /** Module name */
  readonly name: string
  /** Ecosystem */
  readonly ecosystem: Ecosystem
  /** Current analysis state */
  readonly analysisState: AnalysisState
  /** Dependencies matching the query filters */
  readonly dependencies: readonly Dependency[]
  /** Count of total deps (before filtering) for context */
  readonly totalDependencyCount: number
}
```

## ViewSummary

Aggregate counts for the filtered result set. Displayed in overview cards and filter badges.

```typescript
interface ViewSummary {
  /** Total dependencies in the filtered view */
  readonly totalDeps: number
  /** Breakdown by ecosystem */
  readonly byEcosystem: Readonly<Record<Ecosystem, number>>
  /** Breakdown by scope */
  readonly byScope: Readonly<Record<DependencyScope, number>>
  /** Number of outdated deps (only if registry-enriched) */
  readonly outdatedCount: number | null
  /** Number of unused deps (only if imports-resolved) */
  readonly unusedCount: number | null
  /** Number of modules in the view */
  readonly moduleCount: number
  /** Number of cross-language edges in the view */
  readonly crossEdgeCount: number
}
```

## View Hierarchy

The default drill-down path in the UI. Users can enter at any level and filter cross-axis.

```
Project Overview  (all ecosystems, summary cards, cross-lang edges)
  └─► Ecosystem View  (e.g. "All Python deps across all modules")
       └─► Module View  (e.g. "Python deps in services/auth/")
            └─► Dependency Detail  (single dep: where used, transitive tree, registry info)
```

Cross-cutting views (concern filter, search) work at any level:
- "Show all HTTP libraries" = concern filter at project level
- "Search for 'stripe'" = search across all ecosystems and modules

### Concern View

The **Concern View** is a cross-cutting filter, not a separate view type. It uses the `concern` field on `ViewQuery` to filter dependencies by their concern tags (e.g. `http`, `database`, `auth`, `logging`). The Concern View in the UI architecture diagram represents a UI component that pre-sets the `concern` filter and groups results by concern tag across all ecosystems and modules.

This means:
- No separate `ConcernViewQuery` type — it's just a `ViewQuery` with `concern` set
- The UI component displays grouped-by-concern results from the standard `ViewResult`
- Concern tags come from the built-in curated database + user overrides via `.deckgraph.yaml`

---

## Related Links

- [ARCHITECTURE.md](../ARCHITECTURE.md) — Query engine description
- [Project Schema](./project.md) — Types referenced in view results (Module, Dependency, CrossEdge)
- [Adapter Schema](./adapters.md) — How data enters the graph that views query
