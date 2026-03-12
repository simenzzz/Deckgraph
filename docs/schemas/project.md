# Project Schemas

> **Canonical source:** `packages/shared/src/types/project.ts`
> **Last verified:** Pre-implementation (schema designed, not yet coded)

Ecosystem-agnostic types representing a scanned project. All ecosystem-specific details are normalized into these types by the [adapters](./adapters.md).

## Ecosystem

```typescript
type Ecosystem = "npm" | "pypi" | "cargo" | "go" | "maven"
```

## Project

Top-level object representing the scanned monorepo.

```typescript
interface Project {
  /** Absolute path to the monorepo root */
  readonly root: string
  /** Project-level config from .Deckgraph.yaml (null if absent) */
  readonly config: ProjectConfig | null
  /** Auto-discovered modules */
  readonly modules: readonly Module[]
  /** Cross-language edges detected between modules */
  readonly crossEdges: readonly CrossEdge[]
  /** Timestamp of last scan */
  readonly lastScannedAt: string
}

interface ProjectConfig {
  /** Paths to ignore during discovery (glob patterns) */
  readonly ignorePaths: readonly string[]
  /** User-defined concern tag overrides */
  readonly concernOverrides: Readonly<Record<string, readonly string[]>>
}
```

## Module

A discovered unit within the monorepo — a directory with a manifest file for a specific ecosystem.

```typescript
interface Module {
  /** Relative path from project root */
  readonly path: string
  /** Human-readable name (from manifest or directory name) */
  readonly name: string
  /** Which ecosystem this module belongs to */
  readonly ecosystem: Ecosystem
  /** Manifest files found (e.g. ["package.json", "pnpm-lock.yaml"]) */
  readonly manifests: readonly string[]
  /** Declared dependencies (populated during Phase 1: Manifest Scan) */
  readonly dependencies: readonly Dependency[]
  /** How deeply this module has been analyzed */
  readonly analysisState: AnalysisState
}

type AnalysisState = "manifest-only" | "imports-resolved" | "registry-enriched"
```

### AnalysisState Invalidation Rules

When files change in a module's directory, `analysisState` is invalidated according to these rules:

- **Manifest file changes** (e.g. `package.json`, `pyproject.toml`, `go.mod`) — Re-parse the manifest; state resets to `manifest-only`. All previously resolved imports and registry data for the module are discarded.
- **Source file changes** (e.g. `.ts`, `.py`, `.go`) — If the module was at `imports-resolved` or `registry-enriched`, state resets to `manifest-only`. The user must re-trigger import analysis.
- **UI indicator** — When a module's `analysisState` has been invalidated, the UI shows a stale indicator on that module. The user can re-trigger analysis on demand.
- **No automatic re-analysis** — Invalidation only marks state as stale. Re-analysis is always user-initiated (consistent with the lazy pipeline philosophy from [ADR-004](../adr/004-lazy-analysis-pipeline.md)).

## Dependency

Ecosystem-agnostic dependency. Constraint syntax is ecosystem-specific but stored as a raw string.

```typescript
interface Dependency {
  /** Package name as the ecosystem knows it */
  readonly name: string
  /** Which ecosystem this dependency belongs to */
  readonly ecosystem: Ecosystem
  /** Resolved/installed version */
  readonly version: string
  /** Raw constraint string (semver, PEP 440, Cargo req, etc.) */
  readonly constraint: string
  /** Generalized scope */
  readonly scope: DependencyScope
  /** How this dependency was discovered */
  readonly source: "manifest" | "import-only" | "both"
  /** Concern tags (from built-in database + user overrides) */
  readonly concerns: readonly string[]

  // --- Lazy-loaded fields (null until the relevant analysis phase completes) ---

  /** Files that import this package (Phase 2: Import Analysis) */
  readonly usedInFiles: readonly string[] | null
  /** Direct transitive dependencies (from lock file or registry) */
  readonly transitiveDeps: readonly string[] | null
  /** Registry metadata (Phase 3: Registry Enrichment) */
  readonly registryMeta: RegistryMeta | null
}

type DependencyScope = "runtime" | "dev" | "build" | "optional" | "peer"
```

## RegistryMeta

Ecosystem-agnostic registry metadata. Fields that a specific registry doesn't expose are `null`.

```typescript
interface RegistryMeta {
  /** Latest available version */
  readonly latestVersion: string
  /** Package description */
  readonly description: string
  /** License identifier (SPDX) */
  readonly license: string | null
  /** Project homepage URL */
  readonly homepage: string | null
  /** Download count (not all registries expose this) */
  readonly downloads: number | null
  /** Whether this package is deprecated */
  readonly deprecated: boolean
  /** When the latest version was published */
  readonly publishedAt: string | null
}
```

## CrossEdge

A detected relationship between modules in different ecosystems.

```typescript
interface CrossEdge {
  /** Source module */
  readonly from: CrossEdgeEndpoint
  /** Target module */
  readonly to: CrossEdgeEndpoint
  /** What kind of cross-language relationship */
  readonly type: CrossEdgeType
  /** Human-readable explanation */
  readonly evidence: string
  /** Detection confidence (0–1) */
  readonly confidence: number
}

interface CrossEdgeEndpoint {
  /** Module path (relative to project root) */
  readonly module: string
  /** Ecosystem of this module */
  readonly ecosystem: Ecosystem
}

type CrossEdgeType = "proto" | "openapi" | "ffi" | "build" | "shared-config"
```

## Graph Types

Internal to the backend. The unified graph holds modules, dependencies, and cross-language edges.

```typescript
interface UnifiedGraph {
  /** All modules keyed by path */
  readonly modules: ReadonlyMap<string, Module>
  /** Forward edges: module/dep → its dependencies */
  readonly forward: ReadonlyMap<string, ReadonlySet<string>>
  /** Reverse edges: dep → what depends on it */
  readonly reverse: ReadonlyMap<string, ReadonlySet<string>>
  /** Cross-language edges */
  readonly crossEdges: readonly CrossEdge[]
}
```

## WebSocket Messages

See [Views Schema](./views.md) for `ViewQuery` and `ViewResult` types used in messages.

### Client Messages (UI → Backend)

```typescript
type ClientMessage =
  | ScanProjectMessage
  | ViewQueryMessage
  | AnalyzeImportsMessage
  | EnrichDependencyMessage
  | SyncMessage

interface ScanProjectMessage {
  readonly type: "scan_project"
  readonly requestId: string
}

interface ViewQueryMessage {
  readonly type: "view_query"
  readonly requestId: string
  readonly query: ViewQuery
}

interface AnalyzeImportsMessage {
  readonly type: "analyze_imports"
  readonly requestId: string
  readonly modulePath: string
}

interface EnrichDependencyMessage {
  readonly type: "enrich_dependency"
  readonly requestId: string
  readonly ecosystem: Ecosystem
  readonly packageName: string
}

interface SyncMessage {
  readonly type: "sync"
  readonly requestId: string
}
```

### Server Messages (Backend → UI)

```typescript
type ServerMessage =
  | ProjectOverviewMessage
  | ViewResultMessage
  | ModuleUpdatedMessage
  | DependencyEnrichedMessage
  | ProgressMessage
  | ErrorMessage

interface ProjectOverviewMessage {
  readonly type: "project_overview"
  readonly requestId: string
  readonly data: Project
}

interface ViewResultMessage {
  readonly type: "view_result"
  readonly requestId: string
  readonly data: ViewResult
}

interface ModuleUpdatedMessage {
  readonly type: "module_updated"
  readonly requestId: string
  readonly module: Module
}

interface DependencyEnrichedMessage {
  readonly type: "dependency_enriched"
  readonly requestId: string
  readonly dependency: Dependency
}

interface ProgressMessage {
  readonly type: "progress"
  readonly requestId: string
  readonly message: string
  readonly phase: 0 | 1 | 2 | 3
}

interface ErrorMessage {
  readonly type: "error"
  readonly requestId: string
  readonly message: string
  readonly suggestion: string
}
```

---

## Related Links

- [ARCHITECTURE.md](../ARCHITECTURE.md) — System overview and data flow
- [Adapter Schema](./adapters.md) — EcosystemAdapter interface, per-ecosystem details
- [View Schema](./views.md) — ViewQuery, ViewResult types
- [ADR-003](../adr/003-tree-sitter-unified-parser.md) — Parser technology choice
