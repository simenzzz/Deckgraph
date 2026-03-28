# Deckgraph Implementation Roadmap

## Context

Deckgraph has 2,200+ lines of high-quality documentation and zero lines of code. The architecture is well-designed (lazy pipeline, adapter pattern, backend-as-truth), and a previous audit (mighty-seeking-robin.md) already fixed critical doc issues (async parseManifests, ImportPackageMap, FFI confidence, setup.py/build.gradle limitations, web-tree-sitter).

The Phase 1 checklist in CLAUDE.md contains 18 items — too large for a single sprint. This roadmap breaks it into 7 sub-phases, each delivering something testable. The strategy is **vertical slice first**: get JS/TS flowing end-to-end (including exploration), then widen to all 5 ecosystems, then add cross-language detection and concern tagging.

---

## Phase 1a: Monorepo Scaffold + Shared Types (S)

**Goal:** Build compiles, types importable, `npx deckgraph` prints version.

**What to build:**
- Root: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.json`, `.gitignore`, `.npmrc`
- `packages/shared/` — All TypeScript types from schema docs + Zod schemas for runtime validation
  - `src/types/project.ts` — Ecosystem, Project, Module, Dependency, RegistryMeta, CrossEdge, UnifiedGraph
  - `src/types/adapters.ts` — EcosystemAdapter, ManifestResult, ParsedImport, ImportPackageMap, AdapterRegistry
  - `src/types/views.ts` — ViewQuery, ViewResult, ModuleView, ViewSummary
  - `src/types/messages.ts` — ClientMessage, ServerMessage unions
  - `src/schemas/` — Zod schemas mirroring each type file
  - `src/index.ts` — barrel export
- `packages/backend/package.json` with `"bin": { "deckgraph": "./dist/index.js" }`, minimal `src/index.ts`
- `packages/ui/package.json` — placeholder

**Key packages:** `typescript`, `turbo`, `zod`, `vitest`

**Tests:** Type guard tests for discriminated unions, Zod parse/reject tests, barrel export coverage

**Demo:** `pnpm install && pnpm build && pnpm test` all pass. `npx deckgraph` prints version.

---

## Phase 1b: Discovery + Adapter System + JS/TS Manifest Parsing (M)

**Goal:** Scan a real JS/TS project and extract all declared dependencies.

**What to build:**
- `packages/backend/src/discovery/moduleDiscovery.ts` — Async filesystem walker, find manifest files, respect ignore patterns (node_modules, .git, dist, vendor, target, __pycache__)
- `packages/backend/src/discovery/ecosystemDetector.ts` — Manifest filename → Ecosystem mapping
- `packages/backend/src/adapters/registry.ts` — AdapterRegistry implementation
- `packages/backend/src/adapters/javascript/manifestParser.ts` — Parse `package.json` deps/devDeps/peerDeps/optionalDeps. Lock file support: `pnpm-lock.yaml` v9 and `package-lock.json` v3 only (others deferred)
- `packages/backend/src/adapters/javascript/index.ts` — EcosystemAdapter with stubs for importAnalyzer and registryClient
- `packages/backend/src/adapters/index.ts` — Registry creation + JS/TS adapter registration
- `packages/backend/src/config/configLoader.ts` — `.deckgraph.yaml` reader (Zod-validated)

**Key packages:** `pino`, `fast-glob`, `js-yaml`

**Tests:** Discovery with fixture directory trees. Ecosystem detection. Registry register/lookup. JS manifest parsing with real package.json fixtures. Lock file parsing. Config loader valid/invalid/missing.

**Demo:** CLI script scans any JS project → prints module count, total deps, dep names.

---

## Phase 1c: Unified Graph + Query Engine (M-L)

**Goal:** Build the dependency DAG and query it with filters.

**What to build:**
- `packages/backend/src/graph/dependencyGraph.ts` — `buildGraph(modules)` factory, immutable adjacency lists (forward + reverse), add/remove module functions returning new graph instances
- `packages/backend/src/graph/cycleDetector.ts` — Kahn's algorithm
- `packages/backend/src/graph/queryEngine.ts` — `executeQuery(graph, query): ViewResult` with filtering by ecosystem, modules, scopes, depth, fuzzy search. Computes ViewSummary aggregates
- `packages/backend/src/scanner/scanner.ts` — Orchestrator: discovery → adapter routing → graph construction → returns Project

**Key packages:** `fuse.js`

**Tests:** Graph construction from fixtures. Immutability verification. Cycle detection (no cycles, simple, complex). Query engine: single filter, combined filters, empty query, fuzzy search. Scanner integration test with fixture directory.

**Demo:** Run scanner on a real pnpm monorepo → query "show all runtime deps" / "search for react" / "deps in package X" → print ViewResult.

---

## Phase 1d: WebSocket Server + Protocol (S-M)

**Goal:** Backend serves data over WebSocket. Can interact via wscat.

**What to build:**
- `packages/backend/src/ws/server.ts` — `ws` server bound to `127.0.0.1` only, no auth (localhost trust), client management
- `packages/backend/src/ws/protocol.ts` — Zod-validated message routing. Handlers: `scan_project` → `project_overview`, `view_query` → `view_result`, `sync` → current state. `analyze_imports` and `enrich_dependency` return "not yet available" errors
- `packages/backend/src/ws/progress.ts` — Progress message utility for long operations
- Update `packages/backend/src/index.ts` — CLI arg parsing (`--project`, `--port`), start WS server, run scan, open browser

**Key packages:** `ws`, `pino-pretty` (dev), `commander`, `open`

**Tests:** Server start/accept/shutdown. Valid messages → correct responses. Invalid JSON → error. Unknown type → error with suggestion. Progress emission during scan. Error handler catches throws → ErrorMessage (no stack traces). Verify server binds to 127.0.0.1 only.

**Demo:** `npx deckgraph --project /path` starts server. `wscat -c ws://localhost:3333` → send `{"type":"scan_project","requestId":"1"}` → receive project overview JSON.

---

## Phase 1e: UI Skeleton + Overview + Module Explorer (M-L)

**First vertical slice: end-to-end from scan to browser, including dependency exploration.**

**What to build:**
- Vite + React 19 + Tailwind v4 + shadcn/ui scaffold
- `src/lib/wsClient.ts` — Typed WS client with reconnect, Zod validation of incoming messages
- Zustand stores: `projectStore` (Project cache), `viewStore` (ViewResult cache), `filterStore` (local), `connectionStore` (status)
- Layout: `Shell.tsx`, `Header.tsx` (project name, connection status, scan button), `Sidebar.tsx` (nav)
- Overview: `ProjectOverview.tsx`, `EcosystemCard.tsx` (icon, module count, dep count per ecosystem), `HealthSummary.tsx` (totals)
- Module Explorer: `ModuleList.tsx` (paginated, sortable module list with ecosystem badges), `DependencyList.tsx` (dependency table for selected module: name, version, constraint, scope), `FilterBar.tsx` (ecosystem multi-select, scope filter, search input with debounce)
- `hooks/useViewQuery.ts` — Composes filterStore → ViewQuery → WS message
- Backend update: serve built UI static assets from dist/ for production use

**Key packages:** `react`, `react-dom`, `zustand`, `vite`, `@vitejs/plugin-react`, `lucide-react`, `tailwindcss`, `clsx`, `tailwind-merge`, shadcn deps

**Tests:** WS client mock tests (messages sent, store updates, reconnect). Store update tests. Component render tests (loading, error, data states). Module Explorer component tests. Integration: overview → click module → see deps → filter by scope/search.

**Demo:** `npx deckgraph --project /path/to/js-project` → browser opens → dashboard shows npm ecosystem card with real module and dependency counts → Module Explorer filters by ecosystem, scope, search.

---

## Phase 1f: Python + Go + Rust + Java Adapters (L) ✅

**Goal:** All 5 ecosystem adapters with manifest parsing. No cross-lang, no concern tags.

**Python adapter** (`packages/backend/src/adapters/python/`):
- `manifestParser.ts` — `pyproject.toml` (PEP 621 + Poetry), `requirements.txt`, `Pipfile`, `setup.cfg`. Lock files: `poetry.lock`, `Pipfile.lock`. No `setup.py` (documented limitation)
- `importAnalyzer.ts` / `registryClient.ts` — stubs (Phase 2/3)
- `index.ts` — EcosystemAdapter for pypi
- Register in `adapters/index.ts`

**Go adapter** (`adapters/go/`): Parse `go.mod` (require, replace directives) + `go.sum`. Line-based format, regex parsing. Import/registry stubs.

**Rust adapter** (`adapters/rust/`): Parse `Cargo.toml` (deps, dev-deps, build-deps, features) + `Cargo.lock`. TOML format (reuse smol-toml). Import/registry stubs.

**Java adapter** (`adapters/java/`): Parse `pom.xml` (deps + scopes). Simple `build.gradle` support via regex for `implementation`/`testImplementation` only (documented limitation). `gradle.lockfile` if present. Import/registry stubs.

**Key packages:** `smol-toml`, `ini`, `fast-xml-parser`

**Tests:** Python manifest parsing (all 4 formats + lock files). Go manifest parsing. Rust manifest parsing. Java manifest parsing (pom.xml + build.gradle). Integration: scan project with all 5 ecosystems → all show in overview + explorer.

**Demo:** Scan a polyglot project → overview shows all 5 ecosystem cards → Module Explorer shows modules from every ecosystem.

---

## Phase 1g: Cross-Language Edges + Concern Tags (M-L) [COMPLETE]

**Goal:** Cross-language edge detection across all 5 detectors, concern tagging, and UI updates for both.

**Cross-language edge detection:**
- `crosslang/types.ts` — EdgeDetector interface
- `crosslang/protoDetector.ts` — Find `.proto` files, parse package/service, match generated code (`_pb2.py`, `_grpc.pb.go`, `*_pb.d.ts`). Confidence: 0.7-0.8
- `crosslang/ffiDetector.ts` — Pattern-match PyO3, cgo, napi, JNI indicators. Confidence: 0.4-0.6
- `crosslang/openapiDetector.ts` — Parse openapi.yaml/swagger.json, match generated clients. Confidence: 0.7
- `crosslang/buildRefDetector.ts` — docker-compose.yml service contexts, Makefile cross-refs. Confidence: 0.4
- `crosslang/sharedConfigDetector.ts` — Shared .env vars across modules. Confidence: 0.3
- `crosslang/index.ts` — Run all detectors, aggregate edges
- Integrate into scanner pipeline after manifest parsing

**Concern tagger:**
- `concern/tagDatabase.ts` — Curated Map of top ~100 packages per ecosystem → tags (http, database, auth, logging, testing, cli, crypto, etc.)
- `concern/tagger.ts` — Apply tags from DB + user overrides from `.deckgraph.yaml`
- Integrate into scanner pipeline

**UI updates:** Cross-edge count on overview. Concern filter dropdown in FilterBar. Cross-edge list with confidence indicators and type badges.

**Tests:** Proto detector (fixture with .proto + generated code). FFI detector (PyO3/cgo fixtures). OpenAPI detector (openapi.yaml + generated client fixtures). Build ref detector (docker-compose fixtures). Shared config detector (shared .env fixtures). Concern tagger (known packages, overrides, unknowns). Full integration: 5-ecosystem project scanned, filtered, concern-tagged, cross-edges detected.

**Demo:** `npx deckgraph --project /path/to/polyglot-monorepo` → all ecosystems detected → cross-language edges visible (Proto, FFI, OpenAPI shown by default; build refs, shared config togglable) → filter by concern tag "database" shows all DB deps across all ecosystems.

---

## Dependency Chain

```
1a (Scaffold + Types)
 └─► 1b (Discovery + JS/TS Adapter)
      └─► 1c (Graph + Query Engine)
           └─► 1d (WebSocket Server)
                └─► 1e (UI + Overview + Explorer) ← First end-to-end demo (JS/TS vertical slice)
                     └─► 1f (Py/Go/Rust/Java Adapters) ← All 5 ecosystems
                          └─► 1g (Cross-Lang + Concerns) ← Phase 1 complete
```

## Key Files Reference

| Schema Doc | Implements As |
|------------|---------------|
| `docs/schemas/project.md` | `packages/shared/src/types/project.ts` |
| `docs/schemas/adapters.md` | `packages/shared/src/types/adapters.ts` |
| `docs/schemas/views.md` | `packages/shared/src/types/views.ts` |
| `docs/ARCHITECTURE.md` | Overall file structure and module boundaries |

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Lock file format complexity (15+ variants) | Support only pnpm-lock v9 + package-lock v3 initially. Add formats based on demand |
| setup.py / build.gradle are executable code | Skip entirely. Document limitation. Recommend pyproject.toml / pom.xml |
| web-tree-sitter WASM in Node.js | Not needed until Phase 2 (import analysis). No risk in Phase 1 |
| Cross-lang false positives | Conservative confidence (0.4-0.6 FFI, 0.7-0.8 Proto). Show confidence in UI |
| Large monorepo performance | Async discovery + manifest parsing. Stream progress. Target: 200 modules |

## Resolved Decisions

1. **Static asset serving:** Yes — backend serves UI dist/ in production. `npx deckgraph` is a single process.
2. **WS auth:** Deferred. Phase 1 uses localhost-only binding (`127.0.0.1`), no auth needed. Auth will be added in a later phase when remote access is supported.
3. **npm publishing:** Only `@deckgraph/backend` is published to npm (bundles built UI assets). `@deckgraph/shared` is internal workspace-only — never published. It holds shared TypeScript types and Zod schemas so backend and UI agree on data shapes without duplication.

## Verification Plan

After each sub-phase:
1. `pnpm build` — all packages compile
2. `pnpm test` — all tests pass, 80%+ coverage on new code
3. Manual test against a real project (for phases 1b+)
4. After 1e: full end-to-end browser test
5. After 1g: Playwright E2E test: scan → overview → filter → explore

---

## Phase 2: Deep Analysis

**Strategy:** Get JS/TS import analysis working end-to-end first, then fan out to tree-sitter ecosystems, then registry enrichment, then UI views, then remaining detectors + watcher.

---

### Phase 2a: JS/TS Import Analysis + ImportPackageMap (M) [COMPLETE]

**Goal:** AST-parse JS/TS source files to detect which declared deps are actually used.

**What to build:**
- `packages/backend/src/adapters/javascript/importAnalyzer.ts` — @babel/parser, walk ImportDeclaration/require()/dynamic import()
- `packages/backend/src/adapters/importPackageMap.ts` — Curated DB (~50 known mismatches: PIL→Pillow, cv2→opencv-python, @types/*→runtime pkg)
- `packages/backend/src/analysis/importResolver.ts` — Orchestrate: enumerate source files → analyzeImports → resolve via ImportPackageMap → compute usedInFiles → detect unused
- `packages/backend/src/ws/protocol.ts` — Implement `analyze_imports` handler (was "not yet available" stub)

**Key packages:** `@babel/parser`, `@babel/traverse` (already in tree)

**Tests:** ESM/CJS/re-exports/dynamic imports, ImportPackageMap resolution, unused detection with fixture module

**Demo:** Click "Analyze imports" on a JS module → deps annotated with usage counts, unused highlighted

---

### Phase 2b: Tree-sitter Import Analysis for Python/Go/Rust/Java (L) [COMPLETE]

**Goal:** Import analysis across all 5 ecosystems via web-tree-sitter (WASM).

**What to build:**
- `packages/backend/src/adapters/treeSitter/treeSitterLoader.ts` — Init web-tree-sitter, load/cache grammars per ecosystem, singleton per parser
- `packages/backend/src/adapters/python/importAnalyzer.ts` — `import X`, `from X import Y`, curated Python stdlib list
- `packages/backend/src/adapters/go/importAnalyzer.ts` — `import "path"` blocks, stdlib = no dot in path
- `packages/backend/src/adapters/rust/importAnalyzer.ts` — `use crate::`, `extern crate`, cfg-conditional
- `packages/backend/src/adapters/java/importAnalyzer.ts` — `import pkg.Class`, wildcards, package→Maven artifact mapping
- Expand `importPackageMap.ts` with Go replace-directive, Java hierarchy, Rust feature awareness

**Key packages:** `web-tree-sitter`, `tree-sitter-python`, `tree-sitter-go`, `tree-sitter-rust`, `tree-sitter-java` (all WASM)

**Tests:** Per-ecosystem fixtures, stdlib vs third-party classification, ImportPackageMap edge cases

**Demo:** Analyze Python module with `import PIL` → correctly attributed to Pillow. All 5 ecosystems show unused detection

---

### Phase 2c: Registry Enrichment + Outdated Detection (M) [COMPLETE]

**Goal:** Query ecosystem registries on-demand for latest versions, licenses, deprecation. Enable outdated detection.

**What to build:**
- `packages/backend/src/adapters/registryCache.ts` — In-memory LRU, 1hr TTL, per-ecosystem rate limits (npm:50/s, crates.io:1/s, PyPI:10/s, Go:10/s, Maven:5/s)
- `packages/backend/src/adapters/javascript/registryClient.ts` — npm abbreviated metadata API
- `packages/backend/src/adapters/python/registryClient.ts` — PyPI JSON API
- `packages/backend/src/adapters/go/registryClient.ts` — Go proxy API
- `packages/backend/src/adapters/rust/registryClient.ts` — crates.io API
- `packages/backend/src/adapters/java/registryClient.ts` — Maven Central search API
- `packages/backend/src/analysis/outdated.ts` — Compare versions via `semver`. Classify: up-to-date, patch-behind, minor-behind, major-behind
- `packages/backend/src/ws/protocol.ts` — Implement `enrich_dependency` handler

**Key packages:** `semver`, `lru-cache`

**Tests:** LRU eviction/TTL/rate-limiting, mock HTTP responses per registry, Zod catches malformed responses, outdated classification fixtures

**Demo:** Click dependency → "Check for updates" → see latest version, license, deprecation badge, color-coded outdated severity

---

### Phase 2d: Dependency Detail View + Health Report UI (M-L) [COMPLETE]

**Goal:** Deep-dive UI views leveraging import analysis and registry data.

**What to build:**
- `packages/ui/src/components/detail/` — DependencyDetail.tsx, UsageList.tsx, TransitiveTree.tsx, RegistryInfo.tsx
- `packages/ui/src/components/health/` — HealthReport.tsx (tabs), OutdatedReport.tsx, UnusedReport.tsx, LicenseAudit.tsx
- `packages/ui/src/stores/detailStore.ts`, `healthStore.ts`
- `packages/ui/src/hooks/useDependencyDetail.ts`, `useHealthReport.ts`
- Routes: `/dependency/:ecosystem/:name`, `/health`

**Tests:** All states (manifest-only, imports-resolved, registry-enriched), sorting/filtering, copyleft highlighting

**Demo:** Navigate to dep detail → see usage files + registry info. Health Report: outdated sorted by severity, unused grouped by module, license audit with copyleft flags

---

### Phase 2e: Visual Dependency Graph + File Watcher (L) [COMPLETE]

**Goal:** Add visual graph view and enable incremental file watching. (All 5 cross-language detectors were completed in Phase 1g.)

**What to build:**
- `packages/backend/src/watcher/fileWatcher.ts` — chokidar, debounced (300ms), only watch manifest + source files
- `packages/backend/src/watcher/contentHasher.ts` — xxhash wrapper, immutable Map<path, hash>
- `packages/backend/src/scanner/incrementalScanner.ts` — Re-scan only affected modules after file changes
- `packages/ui/src/components/crosslang/` — CrossLanguageGraph.tsx (dagre + SVG), EdgeList.tsx, EdgeDetail.tsx, CrossEdgeFilter.tsx
- `packages/ui/src/stores/graphStore.ts` — Zustand store for graph layout state
- `packages/ui/src/lib/graphLayout.ts` — dagre layout computation
- `fixtures/polyglot-repo/` — 7-module test fixture across 5 ecosystems
- `e2e/` — Playwright E2E tests (scan, explorer, health, graph views)
- Route: `/cross-language`

**Key packages:** `dagre`, `xxhash-wasm`, `chokidar`, `@playwright/test`

**Tests:** Hash comparison, analysisState invalidation, graph renders nodes/edges, incremental scanner, Playwright E2E (12 tests)

**Demo:** Visual graph with ecosystem-colored nodes. Toggle edge types. Slide confidence threshold. Edit file → auto re-analysis in UI

---

### Phase 2 Dependency Chain

```
2a (JS/TS Import Analysis)
 └─► 2b (Tree-sitter: Py/Go/Rust/Java)
      └─► 2c (Registry Enrichment + Outdated)
           └─► 2d (Detail View + Health Report)  ← Deep analysis demo
                └─► 2e (Cross-Lang + Graph + Watcher)  ← Phase 2 complete
```

Note: 2c doesn't strictly need 2b (only needs 2a's WS changes). Can parallelize 2b and 2c if time-pressured.

---

## Phase 3: Management

**Strategy:** Start with safest operation (update single dep), expand to install/remove, then structural features (polyrepo, hooks). Significant architectural shift — backend now executes package manager commands.

---

### Phase 3a: Package Update from UI (M-L) [COMPLETE]

**Goal:** Update a single dependency to a specific version with confirmation and rollback.

**What to build:**
- `packages/shared/src/types/messages.ts` — PackageUpdateMessage, PackageUpdateResultMessage
- `packages/shared/src/types/project.ts` — PackageAction type
- `packages/backend/src/actions/packageManager.ts` — Facade delegating to ecosystem executors
- `packages/backend/src/actions/executors/` — npmExecutor.ts, pipExecutor.ts, goExecutor.ts, cargoExecutor.ts, mavenExecutor.ts
- `packages/backend/src/actions/validators.ts` — Pre-flight checks (valid version, package exists, compatibility)
- `packages/ui/src/components/detail/` — UpdateButton.tsx, UpdateConfirmation.tsx

**Key packages:** `execa`

**Tests:** Mock subprocess execution per ecosystem, exit code handling, re-parse manifest after success

**Demo:** Open JS dep detail → click Update → pick version → confirm → watch progress → version updates in UI

---

### Phase 3b: Install + Remove + Batch Operations (M) [COMPLETE]

**Goal:** Complete package management plus batch operations from Health Report.

**What to build:**
- Extend shared message types with PackageInstallMessage, PackageRemoveMessage, PackageBatchMessage
- Extend each executor with `install()` and `remove()` methods
- `packages/backend/src/actions/batchExecutor.ts` — Sequential execution, fail-fast, partial results
- `packages/ui/src/components/explorer/` — PackageSearch.tsx (registry search), InstallDialog.tsx, DependencyActions.tsx (context menu)
- `packages/ui/src/components/health/BatchActions.tsx` — "Update all outdated", "Remove all unused" with confirmation

**Tests:** Install/remove per ecosystem, batch fail-fast with partial results

**Demo:** Search registry → install package → see it in dep list. Remove unused from Health Report. "Update all outdated" on module with 5 outdated deps

---

### Phase 3c: Polyrepo Support + Developer Hooks (M)

**Goal:** Multiple project roots and configurable event hooks.

**What to build:**
- `packages/shared/src/types/project.ts` — Workspace type wrapping multiple Projects
- `packages/backend/src/discovery/workspaceDiscovery.ts` — Multi-root discovery, cross-root dep detection
- `packages/backend/src/graph/workspaceGraph.ts` — Merge per-project graphs
- `packages/backend/src/hooks/hookRunner.ts` — Execute shell hooks on events (onScanComplete, onOutdated, onUnused, onLicenseViolation)
- `packages/backend/src/hooks/notifier.ts` — Push notifications to UI
- Extend `.deckgraph.yaml` schema: `roots: string[]`, `hooks: {...}`
- `packages/ui/src/components/layout/` — NotificationPanel.tsx, WorkspaceSwitcher.tsx

**Tests:** Multi-root discovery, workspace graph merging, hook execution, notification rendering

**Demo:** Configure 2 project roots → workspace-level overview. Hook fires on outdated → notification in UI

---

### Phase 3 Dependency Chain

```
Phase 2 complete
 └─► 3a (Package Update)
      └─► 3b (Install + Remove + Batch)
           └─► 3c (Polyrepo + Hooks)  ← Phase 3 complete
```

---

## Phase 4: Polish & Distribution

**Strategy:** Fix roughest edges first (error UX), then performance, then expand distribution (VS Code), then docs for external users. 4a and 4c can run in parallel.

---

### Phase 4a: Error UX Polish + Onboarding (S-M)

**Goal:** Every error state has clear message + suggestion + recovery. New users self-serve.

**What to build:**
- `packages/backend/src/errors/errorCatalog.ts` — Centralized error catalog with code, message template, suggestion template
- `packages/backend/src/errors/errorMapper.ts` — Map ENOENT/EACCES/ECONNREFUSED/Zod errors to catalog entries
- `packages/ui/src/components/errors/` — ErrorBoundary.tsx, ErrorCard.tsx, EmptyState.tsx
- `packages/ui/src/components/onboarding/` — WelcomeScreen.tsx, GuidedTour.tsx

**Tests:** Error catalog formatting, error mapper coverage, ErrorBoundary catch, WelcomeScreen flow

**Demo:** Disconnect internet → try enrichment → friendly "Registry unreachable" message. First launch → welcome screen → guided tour

---

### Phase 4b: Performance Optimization (M)

**Goal:** 200-module scan < 5s, smooth UI with 5000+ deps.

**What to build:**
- `packages/backend/src/profiler/scanProfiler.ts` — Instrument scan pipeline timing
- Optimize discovery (parallel traversal with concurrency limit)
- Optimize registryCache (batch queries, disk-persisted option)
- Optimize queryEngine (pre-computed indices, lazy ViewSummary)
- `packages/ui/src/components/explorer/VirtualizedModuleList.tsx`, `VirtualizedDependencyList.tsx`
- WS message batching in wsClient.ts (batch per animation frame)

**Key packages:** `@tanstack/react-virtual`

**Tests:** Profiler collects timing, batch queries respect rate limits, ViewSummary under 50ms for 5000 deps, virtualized lists ~20 DOM elements for 1000 items

**Demo:** Scan 200-module monorepo < 5s. Smooth scroll through 1000 modules

---

### Phase 4c: VS Code Extension (L)

**Goal:** Dependency insights directly in the editor.

**What to build:**
- `packages/vscode/` — New package
- extension.ts, backendManager.ts (spawn/connect backend), webviewProvider.ts (host React UI)
- treeDataProvider.ts (sidebar module tree), commands.ts, decorations.ts (inline version annotations in manifests), codeLens.ts (usage counts above imports)

**Key packages:** `@types/vscode`, `vscode-webview-ui-toolkit`

**Tests:** Backend lifecycle, tree rendering, command triggers, decoration ranges

**Demo:** Install extension → sidebar module tree → dashboard webview → inline version decorations in package.json → CodeLens above imports

---

### Phase 4d: Documentation Site + Community Readiness (S-M)

**Goal:** Comprehensive docs for users and contributors. Ready for public release.

**What to build:**
- `docs-site/` — VitePress site: Getting Started, Config reference, Ecosystem support, CLI reference, VS Code guide, FAQ, Contributing
- `.github/workflows/ci.yml`, `.github/workflows/release.yml`
- Root `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`
- CLI `--help` output

**Key packages:** `vitepress`, `changesets`

**Tests:** CI pipeline passes, docs build, all internal links resolve

**Demo:** Follow Getting Started guide end-to-end. Contribute a concern tag via PR

---

### Phase 4 Dependency Chain

```
Phase 3 complete
 ├─► 4a (Error UX) → 4b (Performance)
 └─► 4c (VS Code Extension)          ← parallel with 4a/4b
      └─► 4d (Docs + Release)  ← Phase 4 complete
```

---

## Full Dependency Chain (All Phases)

```
Phase 1g (complete) ─────────────────────────────────────────
 └─► 2a (JS/TS Import Analysis)
      └─► 2b (Tree-sitter Imports)
           └─► 2c (Registry Enrichment)
                └─► 2d (Detail + Health UI)
                     └─► 2e (Cross-Lang + Graph + Watcher) ← Phase 2
                          └─► 3a (Package Update)
                               └─► 3b (Install + Remove + Batch)
                                    └─► 3c (Polyrepo + Hooks) ← Phase 3
                                         ├─► 4a (Error UX) → 4b (Perf)
                                         └─► 4c (VS Code)
                                              └─► 4d (Docs) ← Phase 4
```

---

## Risks & Mitigations (Phases 2-4)

| Risk | Phase | Mitigation |
|------|-------|------------|
| web-tree-sitter WASM loading slow/incompatible in Node | 2b | Test early. Fallback: regex-based extraction (lower accuracy). Native bindings as last resort |
| Import-to-package mapping has long tail of mismatches | 2a-2b | Start with ~50 known. Log unresolved. Community contribution in 4d |
| Registry API rate limits cause enrichment failures | 2c | LRU + rate limiting built in. Exponential backoff on 429. Graceful "registry unavailable" |
| PEP 440 version comparison more complex than semver | 2c | Use `semver` for JS/Rust/Go. Minimal PEP 440 for Python (major.minor.patch only). Document limitation |
| Subprocess execution for package management fragile | 3a-3b | Validate preconditions. Capture stdout/stderr. Show exact command in confirmation. No concurrent pm commands per module |
| Large monorepo file watching too many events | 2e | Debounce 300ms. Only watch manifest + source files. Ignore node_modules/.git/build output |
| VS Code webview perf with large datasets | 4c | Reuse virtualized lists from 4b. Lazy-load on interaction |

---

## Verification Plan (Phases 2-4)

After each sub-phase:
1. `pnpm build` — all packages compile
2. `pnpm test` — all tests pass, 80%+ coverage on new code
3. Manual test against a real polyglot project (2a+)

Phase milestones:
- After 2d: Playwright E2E: scan → analyze imports → view detail → health report
- After 2e: Playwright E2E: cross-language graph → toggle edges → edit file → auto-update
- After 3b: Playwright E2E: update dep → install new → remove → verify manifest changed
- After 4b: Benchmark: 200-module scan < 5s, 5000-dep scroll smooth
- After 4c: VS Code extension loads, tree view, webview dashboard
- After 4d: Docs site builds, all links resolve, Getting Started works end-to-end
