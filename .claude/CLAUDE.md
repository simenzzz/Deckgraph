# Deckgraph

## Project Overview

Deckgraph is a **multi-language dependency exploration and audit tool** for large codebases. It scans a monorepo, auto-detects modules across ecosystems (JS/TS, Python, Go, Rust, Java), builds a unified dependency graph with cross-language edges, and presents layered, filterable views through an interactive web interface.

**Core value proposition:** A visual tool that answers: "What libraries does this codebase depend on? Across which languages? Where are they used? Are any outdated or unused? How do the different parts connect?" — all filterable to avoid hairball views, with on-demand deep analysis to stay fast.

---

## Architecture

Two-tier system: **Web UI** (React) communicates over WebSocket with a **Backend** (Node.js). The backend scans the monorepo, builds a unified dependency graph across all ecosystems, and pushes filtered views to the UI.

No MCP protocol, no LLM, no stdio transport. One backend process.

See [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) for diagrams, tech stack, project structure, and security model.

### Ecosystem Adapters

Each language ecosystem (JS/TS, Python, Go, Rust, Java) is handled by a pluggable adapter that bundles three capabilities:
1. **Manifest parsing** — read declared deps from config/lock files (fast, runs on startup)
2. **Import analysis** — AST-parse source files for actual usage (expensive, runs on-demand)
3. **Registry queries** — fetch latest versions, licenses, deprecation status (network-bound, on-demand)

### Lazy Analysis Pipeline

1. **Discovery** — Walk filesystem, detect modules and ecosystems (instant)
2. **Manifest Scan** — Parse manifests + lock files → declared deps (seconds)
3. **Import Analysis** — AST-parse source files → usage data (on-demand per module)
4. **Registry Enrichment** — Query registry APIs → update status (on-demand per dep)

### Cross-Language Edge Detection

Five independent detectors find where ecosystems connect:
- **Proto/gRPC** — `.proto` service contracts (high confidence)
- **FFI** — PyO3, cgo, JNI, napi bindings (high confidence)
- **OpenAPI** — REST API specs and generated clients (medium confidence)
- **Build refs** — docker-compose, Makefile cross-module refs (low confidence, hidden by default)
- **Shared config** — shared env vars/config files (low confidence, hidden by default)

### Package Structure

```
packages/
├── backend/     # Node.js server (adapters, graph, query engine, WS server)
├── ui/          # Web frontend (React 19 + Vite + shadcn/ui)
└── shared/      # Shared types & utilities (sole cross-package dependency)
```

---

## Current Phase

**Phase 2: Deep Analysis** (Active)

Progress:
- [x] 2a: JS/TS import analysis + ImportPackageMap
- [x] 2b: Tree-sitter import analysis (Python, Go, Rust, Java)
- [x] 2c: Registry enrichment + outdated detection
- [x] 2d: Dependency Detail view + Health Report UI
- [ ] 2e: Visual dependency graph + incremental file watching

**When updating this section:** Check off completed items and move to the next phase when all items are done.

---

## Component Design

### Backend

Distributed via npm (`npx Deckgraph --project /path`). Starts a WebSocket server, scans the monorepo, builds the unified dependency graph, and pushes filtered views to the UI.

#### Discovery
Walks the filesystem, detects modules by manifest file presence. Maps each module to its ecosystem.

#### Adapter System
Strategy Pattern with `EcosystemAdapter` interface and `AdapterRegistry`. Each adapter bundles manifest parsing, import analysis, and registry queries. Adding a new ecosystem = implementing the adapter and registering it.

#### Unified Dependency Graph
In-memory DAG combining all ecosystems. Adjacency lists: `Map<string, Set<string>>`. Supports forward/reverse traversal, cycle detection (Kahn's algorithm), cross-language edges, and incremental updates.

#### Query Engine
Translates `ViewQuery` → `ViewResult`. Filters by ecosystem, module, scope, depth, concern tag, and search. The UI never sees the raw graph.

#### Cross-Language Edge Detector
Five independent detectors (Proto, OpenAPI, FFI, build refs, shared config) each produce `CrossEdge` objects with type and confidence. High-confidence edges shown by default; low-confidence hidden but togglable.

#### Concern Tagger
Built-in curated database mapping well-known packages to concern tags (http, database, auth, logging, etc.) across all ecosystems. User overrides via `.Deckgraph.yaml`.

#### Analysis
- **Outdated**: Compare installed vs latest using ecosystem-specific version comparison
- **Unused**: Declared deps not found in import analysis (requires Phase 2)

#### File Watcher
chokidar-based. Content hashing (xxhash) to skip unchanged files. Invalidates `analysisState` and triggers incremental re-scan.

### Web UI

React 19 + Vite + shadcn/ui. Zustand stores are caches of backend-pushed state (no optimistic updates). `filterStore` is local for instant filter toggling.

#### Core Views
1. **Project Overview** — Ecosystem cards, health summary, cross-language edge overview
2. **Module Explorer** — Filterable list of modules with dep counts per ecosystem
3. **Dependency Detail** — Single dep: where used, transitive tree, registry info
4. **Cross-Language Graph** — Visualize cross-ecosystem connections
5. **Health Report** — Unused deps, outdated deps, license audit (filterable)

---

## Error Handling

All errors surfaced to the UI must follow this format:

```typescript
{
  type: "error",
  message: string,    // Plain-language: "what happened"
  suggestion: string  // Plain-language: "what to do about it"
}
```

Never expose stack traces, error codes, or technical jargon in user-facing messages. Use `pino` for all logging. Never log secrets.

---

## Deckgraph-Specific Conventions

General coding style, security, testing, and hook rules are defined in `.claude/rules/`. The following are **Deckgraph-specific** conventions:

### Naming

- `camelCase` for variables, functions, file names (non-component)
- `PascalCase` for types, interfaces, classes, React components, component file names
- Package names use `@Deckgraph/` scope: `@Deckgraph/backend`, `@Deckgraph/ui`, `@Deckgraph/shared`

### Package Boundaries

- `packages/shared/` is the **only** package that other packages may depend on for types
- UI must **never** import from backend directly
- All UI-to-backend communication goes through the WebSocket protocol

### Adapter Conventions

- All scanning goes through `AdapterRegistry` — never call parsers directly
- Adapters are stateless — input data, return results, no side effects
- Each adapter in its own directory under `adapters/`

### External Data Validation

All external data is Zod-validated: registry API responses, user WebSocket messages, parsed manifest content. Never trust external data.

### Phase Tracking

When a phase or sub-phase is completed, update **both**:
1. The checklist in this file (under "Implementation Phases")
2. The corresponding entry in [docs/implementation_roadmap.md](../docs/implementation_roadmap.md)

---

## Development Commands

```bash
# Install all dependencies
pnpm install

# Run all packages in dev mode
pnpm dev

# Build all packages
pnpm build

# Run tests
pnpm test
```

---

## Testing Strategy

| Package | Unit Tests | Integration Tests | E2E Tests |
|---------|-----------|-------------------|-----------| 
| `backend` | Adapter tests (per ecosystem), graph construction, query engine, cross-lang detection | WS protocol, registry integration | - |
| `shared` | Type guards, utility functions | - | - |
| `ui` | Component rendering, store logic, filter interactions | WebSocket connection handling | Playwright: scan → overview → explore → detail flow |

For testing methodology (TDD workflow, coverage requirements), see `.claude/rules/testing.md`.

---

## Implementation Phases

### Phase 1: Foundation (Complete)
- [x] 1a: Monorepo scaffold + shared types + `npx deckgraph` entry point
- [x] 1b: Module discovery + adapter system + JS/TS manifest parsing
- [x] 1c: Unified dependency graph (DAG) + query engine (ViewQuery → ViewResult)
- [x] 1d: WebSocket server (localhost-only, no auth) + protocol
- [x] 1e: UI skeleton + Overview dashboard + Module Explorer (JS/TS vertical slice)
- [x] 1f: Python + Go + Rust + Java adapters (manifest parsing only)
- [x] 1g: Cross-language edge detection (all 5 detectors) + concern tags

### Phase 2: Deep Analysis (Active)
- [x] 2a: JS/TS import analysis + ImportPackageMap
- [x] 2b: Tree-sitter import analysis (Python, Go, Rust, Java)
- [x] 2c: Registry enrichment + outdated detection
- [x] 2d: Dependency Detail view + Health Report UI
- [ ] 2e: Visual dependency graph + incremental file watching

### Phase 3: Management (future)
- [ ] Install/update/remove packages from UI (per-ecosystem)
- [ ] Developer hooks and notifications
- [ ] Polyrepo support (multiple project roots)

### Phase 4: Polish & Distribution
- [ ] VS Code extension
- [ ] Error UX polish
- [ ] Performance optimization (profile-driven)
- [ ] Documentation site
- [ ] Community feedback iteration

---

## Key Algorithms

1. **Ecosystem-specific manifest parsing** — TOML/YAML/XML/JSON parsing per adapter → normalized `Dependency[]`
2. **AST-based import analysis** — tree-sitter (Python, Go, Rust, Java) / `@babel/parser` (JS/TS) → `ParsedImport[]` → classify third-party vs local
3. **Unified dependency graph** — Multi-ecosystem adjacency lists. Kahn's algorithm for cycle detection. BFS/DFS for traversal
4. **Query engine filtering** — ViewQuery → graph projection → ViewResult. Set intersection on filter axes
5. **Cross-language edge detection** — Independent detectors (Proto, FFI, OpenAPI, build, config) → `CrossEdge[]` with confidence scoring
6. **Concern tagging** — Package name → curated tag database lookup → tag assignment. User overrides via config
7. **Incremental analysis** — Content hashing (xxhash) per file → invalidate `analysisState` → re-run affected adapter

---

## References

- **Architecture & diagrams:** [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
- **Data models:** [docs/schemas/project.md](../docs/schemas/project.md)
- **Adapters:** [docs/schemas/adapters.md](../docs/schemas/adapters.md)
- **Views:** [docs/schemas/views.md](../docs/schemas/views.md)
- **Design decisions:** [docs/adr/](../docs/adr/) (001-Babel, 002-Zustand, 003-tree-sitter, 004-Lazy Pipeline)
- **General rules:** `.claude/rules/` (coding-style, security, testing, hooks, patterns)
- **Archived docs:** [docs/archive/](../docs/archive/) — Previous architectures
