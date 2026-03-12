# Plan: Extend docs/implementation_roadmap.md with Phases 2-4

## Context

The implementation roadmap currently only covers Phase 1 (broken into 1a-1g). Phases 2, 3, and 4 exist as bullet lists in CLAUDE.md but have no detailed sub-phase breakdowns. The user wants the same level of detail for the remaining phases.

## What to do

Append Phase 2, 3, and 4 sub-phase breakdowns to `docs/implementation_roadmap.md`, following the same format as Phase 1 (Goal, What to build, Key packages, Tests, Demo per sub-phase).

## Target file

`docs/implementation_roadmap.md` — append after the existing Phase 1 content (after the Verification Plan section at the end).

## Content to append

### Phase 2: Deep Analysis (5 sub-phases)

Strategy: Get JS/TS import analysis working end-to-end first, then fan out to tree-sitter ecosystems, then registry enrichment, then UI views, then remaining detectors + watcher.

**2a: JS/TS Import Analysis + ImportPackageMap (M)**
- Goal: AST-parse JS/TS source files to detect which declared deps are actually used
- Build:
  - `packages/backend/src/adapters/javascript/importAnalyzer.ts` — @babel/parser, walk ImportDeclaration/require()/dynamic import()
  - `packages/backend/src/adapters/importPackageMap.ts` — Curated DB (~50 known mismatches: PIL→Pillow, cv2→opencv-python, @types/*→runtime pkg)
  - `packages/backend/src/analysis/importResolver.ts` — Orchestrate: enumerate source files → analyzeImports → resolve via ImportPackageMap → compute usedInFiles → detect unused
  - `packages/backend/src/ws/protocol.ts` — Implement `analyze_imports` handler (was "not yet available" stub)
- Packages: `@babel/parser`, `@babel/traverse` (already in tree)
- Tests: ESM/CJS/re-exports/dynamic imports, ImportPackageMap resolution, unused detection with fixture module
- Demo: Click "Analyze imports" on a JS module → deps annotated with usage counts, unused highlighted

**2b: Tree-sitter Import Analysis for Python/Go/Rust/Java (L)**
- Goal: Import analysis across all 5 ecosystems via web-tree-sitter (WASM)
- Build:
  - `packages/backend/src/adapters/treeSitter/treeSitterLoader.ts` — Init web-tree-sitter, load/cache grammars per ecosystem, singleton per parser
  - `packages/backend/src/adapters/python/importAnalyzer.ts` — `import X`, `from X import Y`, curated Python stdlib list
  - `packages/backend/src/adapters/go/importAnalyzer.ts` — `import "path"` blocks, stdlib = no dot in path
  - `packages/backend/src/adapters/rust/importAnalyzer.ts` — `use crate::`, `extern crate`, cfg-conditional
  - `packages/backend/src/adapters/java/importAnalyzer.ts` — `import pkg.Class`, wildcards, package→Maven artifact mapping
  - Expand `importPackageMap.ts` with Go replace-directive, Java hierarchy, Rust feature awareness
- Packages: `web-tree-sitter`, `tree-sitter-python`, `tree-sitter-go`, `tree-sitter-rust`, `tree-sitter-java` (all WASM)
- Tests: Per-ecosystem fixtures, stdlib vs third-party classification, ImportPackageMap edge cases
- Demo: Analyze Python module with `import PIL` → correctly attributed to Pillow. All 5 ecosystems show unused detection

**2c: Registry Enrichment + Outdated Detection (M)**
- Goal: Query ecosystem registries on-demand for latest versions, licenses, deprecation. Enable outdated detection
- Build:
  - `packages/backend/src/adapters/registryCache.ts` — In-memory LRU, 1hr TTL, per-ecosystem rate limits (npm:50/s, crates.io:1/s, PyPI:10/s, Go:10/s, Maven:5/s)
  - `packages/backend/src/adapters/javascript/registryClient.ts` — npm abbreviated metadata API
  - `packages/backend/src/adapters/python/registryClient.ts` — PyPI JSON API
  - `packages/backend/src/adapters/go/registryClient.ts` — Go proxy API
  - `packages/backend/src/adapters/rust/registryClient.ts` — crates.io API
  - `packages/backend/src/adapters/java/registryClient.ts` — Maven Central search API
  - `packages/backend/src/analysis/outdated.ts` — Compare versions via `semver`. Classify: up-to-date, patch-behind, minor-behind, major-behind
  - `packages/backend/src/ws/protocol.ts` — Implement `enrich_dependency` handler
- Packages: `semver`, `lru-cache`
- Tests: LRU eviction/TTL/rate-limiting, mock HTTP responses per registry, Zod catches malformed responses, outdated classification fixtures
- Demo: Click dependency → "Check for updates" → see latest version, license, deprecation badge, color-coded outdated severity

**2d: Dependency Detail View + Health Report UI (M-L)**
- Goal: Deep-dive UI views leveraging import analysis and registry data
- Build:
  - `packages/ui/src/components/detail/` — DependencyDetail.tsx, UsageList.tsx, TransitiveTree.tsx, RegistryInfo.tsx
  - `packages/ui/src/components/health/` — HealthReport.tsx (tabs), OutdatedReport.tsx, UnusedReport.tsx, LicenseAudit.tsx
  - `packages/ui/src/stores/detailStore.ts`, `healthStore.ts`
  - `packages/ui/src/hooks/useDependencyDetail.ts`, `useHealthReport.ts`
  - Routes: `/dependency/:ecosystem/:name`, `/health`
- Tests: All states (manifest-only, imports-resolved, registry-enriched), sorting/filtering, copyleft highlighting
- Demo: Navigate to dep detail → see usage files + registry info. Health Report: outdated sorted by severity, unused grouped by module, license audit with copyleft flags

**2e: Remaining Cross-Language Detectors + Visual Graph + File Watcher (L)**
- Goal: Complete cross-lang suite, add visual graph view, enable incremental file watching
- Build:
  - `packages/backend/src/crosslang/openapiDetector.ts` — Parse openapi.yaml/swagger.json, match generated clients. Confidence: 0.7
  - `packages/backend/src/crosslang/buildRefDetector.ts` — docker-compose.yml service contexts, Makefile cross-refs. Confidence: 0.4
  - `packages/backend/src/crosslang/sharedConfigDetector.ts` — Shared .env vars across modules. Confidence: 0.3
  - `packages/backend/src/watcher/fileWatcher.ts` — chokidar, debounced (300ms), only watch manifest + source files
  - `packages/backend/src/watcher/contentHasher.ts` — xxhash wrapper, immutable Map<path, hash>
  - `packages/ui/src/components/crosslang/` — CrossLanguageGraph.tsx (dagre + SVG), EdgeList.tsx, EdgeDetail.tsx, CrossEdgeFilter.tsx
  - Route: `/cross-language`
- Packages: `dagre`, `xxhash-wasm`, `chokidar`
- Tests: Each detector with fixtures, hash comparison, analysisState invalidation, graph renders nodes/edges
- Demo: Visual graph with ecosystem-colored nodes. Toggle edge types. Slide confidence threshold. Edit file → auto re-analysis in UI

**Phase 2 dependency chain:**
```
2a (JS/TS Import Analysis)
 └─► 2b (Tree-sitter: Py/Go/Rust/Java)
      └─► 2c (Registry Enrichment + Outdated)
           └─► 2d (Detail View + Health Report)  ← Deep analysis demo
                └─► 2e (Cross-Lang + Graph + Watcher)  ← Phase 2 complete
```
Note: 2c doesn't strictly need 2b (only needs 2a's WS changes). Can parallelize 2b and 2c if time-pressured.

---

### Phase 3: Management (3 sub-phases)

Strategy: Start with safest operation (update single dep), expand to install/remove, then structural features (polyrepo, hooks). Significant architectural shift — backend now executes package manager commands.

**3a: Package Update from UI (M-L)**
- Goal: Update a single dependency to a specific version with confirmation and rollback
- Build:
  - `packages/shared/src/types/messages.ts` — PackageUpdateMessage, PackageUpdateResultMessage
  - `packages/shared/src/types/project.ts` — PackageAction type
  - `packages/backend/src/actions/packageManager.ts` — Facade delegating to ecosystem executors
  - `packages/backend/src/actions/executors/` — npmExecutor.ts, pipExecutor.ts, goExecutor.ts, cargoExecutor.ts, mavenExecutor.ts
  - `packages/backend/src/actions/validators.ts` — Pre-flight checks (valid version, package exists, compatibility)
  - `packages/ui/src/components/detail/` — UpdateButton.tsx, UpdateConfirmation.tsx
- Packages: `execa`
- Tests: Mock subprocess execution per ecosystem, exit code handling, re-parse manifest after success
- Demo: Open JS dep detail → click Update → pick version → confirm → watch progress → version updates in UI

**3b: Install + Remove + Batch Operations (M)**
- Goal: Complete package management plus batch operations from Health Report
- Build:
  - Extend shared message types with PackageInstallMessage, PackageRemoveMessage, PackageBatchMessage
  - Extend each executor with `install()` and `remove()` methods
  - `packages/backend/src/actions/batchExecutor.ts` — Sequential execution, fail-fast, partial results
  - `packages/ui/src/components/explorer/` — PackageSearch.tsx (registry search), InstallDialog.tsx, DependencyActions.tsx (context menu)
  - `packages/ui/src/components/health/BatchActions.tsx` — "Update all outdated", "Remove all unused" with confirmation
- Tests: Install/remove per ecosystem, batch fail-fast with partial results
- Demo: Search registry → install package → see it in dep list. Remove unused from Health Report. "Update all outdated" on module with 5 outdated deps

**3c: Polyrepo Support + Developer Hooks (M)**
- Goal: Multiple project roots and configurable event hooks
- Build:
  - `packages/shared/src/types/project.ts` — Workspace type wrapping multiple Projects
  - `packages/backend/src/discovery/workspaceDiscovery.ts` — Multi-root discovery, cross-root dep detection
  - `packages/backend/src/graph/workspaceGraph.ts` — Merge per-project graphs
  - `packages/backend/src/hooks/hookRunner.ts` — Execute shell hooks on events (onScanComplete, onOutdated, onUnused, onLicenseViolation)
  - `packages/backend/src/hooks/notifier.ts` — Push notifications to UI
  - Extend `.deckgraph.yaml` schema: `roots: string[]`, `hooks: {...}`
  - `packages/ui/src/components/layout/` — NotificationPanel.tsx, WorkspaceSwitcher.tsx
- Tests: Multi-root discovery, workspace graph merging, hook execution, notification rendering
- Demo: Configure 2 project roots → workspace-level overview. Hook fires on outdated → notification in UI

**Phase 3 dependency chain:**
```
Phase 2 complete
 └─► 3a (Package Update)
      └─► 3b (Install + Remove + Batch)
           └─► 3c (Polyrepo + Hooks)  ← Phase 3 complete
```

---

### Phase 4: Polish & Distribution (4 sub-phases)

Strategy: Fix roughest edges first (error UX), then performance, then expand distribution (VS Code), then docs for external users. 4a and 4c can run in parallel.

**4a: Error UX Polish + Onboarding (S-M)**
- Goal: Every error state has clear message + suggestion + recovery. New users self-serve
- Build:
  - `packages/backend/src/errors/errorCatalog.ts` — Centralized error catalog with code, message template, suggestion template
  - `packages/backend/src/errors/errorMapper.ts` — Map ENOENT/EACCES/ECONNREFUSED/Zod errors to catalog entries
  - `packages/ui/src/components/errors/` — ErrorBoundary.tsx, ErrorCard.tsx, EmptyState.tsx
  - `packages/ui/src/components/onboarding/` — WelcomeScreen.tsx, GuidedTour.tsx
- Tests: Error catalog formatting, error mapper coverage, ErrorBoundary catch, WelcomeScreen flow
- Demo: Disconnect internet → try enrichment → friendly "Registry unreachable" message. First launch → welcome screen → guided tour

**4b: Performance Optimization (M)**
- Goal: 200-module scan < 5s, smooth UI with 5000+ deps
- Build:
  - `packages/backend/src/profiler/scanProfiler.ts` — Instrument scan pipeline timing
  - Optimize discovery (parallel traversal with concurrency limit)
  - Optimize registryCache (batch queries, disk-persisted option)
  - Optimize queryEngine (pre-computed indices, lazy ViewSummary)
  - `packages/ui/src/components/explorer/VirtualizedModuleList.tsx`, `VirtualizedDependencyList.tsx`
  - WS message batching in wsClient.ts (batch per animation frame)
- Packages: `@tanstack/react-virtual`
- Tests: Profiler collects timing, batch queries respect rate limits, ViewSummary under 50ms for 5000 deps, virtualized lists ~20 DOM elements for 1000 items
- Demo: Scan 200-module monorepo < 5s. Smooth scroll through 1000 modules

**4c: VS Code Extension (L)**
- Goal: Dependency insights directly in the editor
- Build:
  - `packages/vscode/` — New package
  - extension.ts, backendManager.ts (spawn/connect backend), webviewProvider.ts (host React UI)
  - treeDataProvider.ts (sidebar module tree), commands.ts, decorations.ts (inline version annotations in manifests), codeLens.ts (usage counts above imports)
- Packages: `@types/vscode`, `vscode-webview-ui-toolkit`
- Tests: Backend lifecycle, tree rendering, command triggers, decoration ranges
- Demo: Install extension → sidebar module tree → dashboard webview → inline version decorations in package.json → CodeLens above imports

**4d: Documentation Site + Community Readiness (S-M)**
- Goal: Comprehensive docs for users and contributors. Ready for public release
- Build:
  - `docs-site/` — VitePress site: Getting Started, Config reference, Ecosystem support, CLI reference, VS Code guide, FAQ, Contributing
  - `.github/workflows/ci.yml`, `.github/workflows/release.yml`
  - Root `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`
  - CLI `--help` output
- Packages: `vitepress`, `changesets`
- Tests: CI pipeline passes, docs build, all internal links resolve
- Demo: Follow Getting Started guide end-to-end. Contribute a concern tag via PR

**Phase 4 dependency chain:**
```
Phase 3 complete
 ├─► 4a (Error UX) → 4b (Performance)
 └─► 4c (VS Code Extension)          ← parallel with 4a/4b
      └─► 4d (Docs + Release)  ← Phase 4 complete
```

---

### Full Dependency Chain (All Phases)

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

### Risks & Mitigations (Phases 2-4)

| Risk | Phase | Mitigation |
|------|-------|------------|
| web-tree-sitter WASM loading slow/incompatible in Node | 2b | Test early. Fallback: regex-based extraction (lower accuracy). Native bindings as last resort |
| Import-to-package mapping has long tail of mismatches | 2a-2b | Start with ~50 known. Log unresolved. Community contribution in 4d |
| Registry API rate limits cause enrichment failures | 2c | LRU + rate limiting built in. Exponential backoff on 429. Graceful "registry unavailable" |
| PEP 440 version comparison more complex than semver | 2c | Use `semver` for JS/Rust/Go. Minimal PEP 440 for Python (major.minor.patch only). Document limitation |
| Subprocess execution for package management fragile | 3a-3b | Validate preconditions. Capture stdout/stderr. Show exact command in confirmation. No concurrent pm commands per module |
| Large monorepo file watching too many events | 2e | Debounce 300ms. Only watch manifest + source files. Ignore node_modules/.git/build output |
| VS Code webview perf with large datasets | 4c | Reuse virtualized lists from 4b. Lazy-load on interaction |

### Verification Plan (Phases 2-4)

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
