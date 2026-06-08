# Future Work

Deferred, agreed-upon changes that are not yet scheduled into a phase. Each entry
captures the problem, the chosen approach, and enough of a blast-radius map to execute
later without re-deriving it.

---

## Split module identity from filesystem path (multi-ecosystem directories)

**Status:** Planned, not started.

### Problem

During discovery, `pickPrimaryEcosystem()` + the `ECOSYSTEM_PRIORITY` table
(`packages/backend/src/discovery/moduleDiscovery.ts:59-65,184-200`) collapse a directory
that contains manifests for more than one ecosystem (e.g. `package.json` +
`pyproject.toml`) into **one** `Module` with **one** ecosystem. npm wins by priority, so
the other ecosystem in that directory silently vanishes: its manifest is parsed by the
wrong adapter (or not at all), its dependencies inherit the wrong ecosystem, the wrong
import analyzer and registry client run, and the UI shows a single mislabeled module.

The priority table is only a symptom. The real defect is the architectural assumption:

> `one directory path === one Module === one ecosystem`

encoded by using `module.path` as the de-facto primary key everywhere — graph `Map`
keys, all WS `m.path === modulePath` lookups, `moduleActionLocks` keys, React `key=`
props, and dagre node ids. Nothing currently tolerates two modules sharing a path.

### Chosen approach (decisions locked)

Replace the lossy "pick one ecosystem" step with a clean split: a directory becomes
**one homogeneous `Module` per ecosystem**, each identified by a new composite
`Module.id` (`"<path>#<ecosystem>"`). `path` stays the physical directory and is no
longer unique. Every per-ecosystem code path (adapters, executors, import analyzer,
registry) keeps working untouched because each module is still single-ecosystem — only
*identity keying* changes from `path` to `id`.

- **Data model:** split into homogeneous modules, add `Module.id = path#ecosystem`.
- **Wire identity:** WS request messages carry **`moduleId`** instead of `modulePath`.
- **UI display:** separate entry per ecosystem, keyed by `id`.

```
services/api/  (package.json + pyproject.toml)
  →  { id:"services/api#npm",  path:"services/api", ecosystem:"npm",  manifests:["package.json"] }
  →  { id:"services/api#pypi", path:"services/api", ecosystem:"pypi", manifests:["pyproject.toml"] }
```

- `id` = `${path}#${ecosystem}` (root dir `.` ⇒ `.#npm`). Single deterministic helper.
- `path` retained verbatim for all filesystem ops (executor cwd, source-file globbing).
- `name` may collide across the two modules; the UI shows an ecosystem badge so separate
  rows remain distinguishable.

### Implementation by layer

**1. shared — types, schemas, helper**
- `shared/src/types/project.ts`: add `readonly id: string` to `Module` (first field).
- New `shared/src/utils/moduleId.ts`: pure helper `moduleId(path, ecosystem)` — single
  source of truth for the `path#ecosystem` format; export from package index.
- `shared/src/schemas/project.ts`: add `id: z.string().min(1).max(1300)` to `moduleSchema`.
- `shared/src/types/views.ts`: add `readonly id: string` to `ModuleView`.
- `shared/src/types/messages.ts`: rename `modulePath` → `moduleId` on
  `AnalyzeImportsMessage`, `PackageUpdateMessage`, `PackageInstallMessage`,
  `PackageRemoveMessage`, and each `PackageBatchOperation`; update matching Zod request
  schemas. Keep `FileChangeDetectedMessage.affectedModules` as **paths**.

**2. discovery — remove the tie-breaker**
- `discovery/moduleDiscovery.ts`: delete `ECOSYSTEM_PRIORITY` and `pickPrimaryEcosystem`.
  In `toDiscoveredModules`, after grouping manifests by directory, sub-group that
  directory's manifests by `detectEcosystem(manifest)` and emit one `DiscoveredModule`
  per distinct ecosystem, each carrying only its own manifests. Single-ecosystem
  directories still yield exactly one module. Unrecognized manifests dropped with the
  existing `logger.warn`.

**3. scanner — adapter selection by ecosystem, stamp the id**
- `scanner/helpers.ts`: `findAdapter` selects via `registry.getAdapterForEcosystem(disc.ecosystem)`;
  `buildModule` sets `id: moduleId(disc.path, disc.ecosystem)`.
- `scanner/incrementalScanner.ts`: rekey `previousByPath` → `previousById` and the
  fresh/discovered sets from `m.path` to `m.id` (≈125-146).

**4. graph — key by id**
- `graph/dependencyGraph.ts`: `moduleMap`, `forward`, and `reverse` membership sets key on
  `mod.id` instead of `mod.path` (23,34,38).
- `graph/queryEngine.ts`: `matchesModuleFilters` keeps filtering `query.modules` against
  **`module.path`** (selecting a path intentionally matches all its ecosystem modules);
  populate `id` when projecting `ModuleView`.
- `UnifiedGraph` doc comments: note maps are keyed by module `id`.

**5. actions — lock by id, cwd by path**
- `actions/packageManager.ts`: `buildContext` still derives `cwd` from `module.path`;
  targeting/lock identity uses `module.id`.
- `actions/batchExecutor.ts` + `ws/types.ts`: `moduleActionLocks` keyed by `moduleId`;
  `PackageBatchOperation` carries `moduleId`; `findModule` resolves by id.

**6. crosslang — endpoints reference id, owner resolved by path+ecosystem**
- `crosslang/fileScanner.ts` `findOwningModule`: when multiple modules share the owning
  path, pick the one whose `ecosystem` matches the file's language; fall back to
  longest-path match.
- Detectors (`protoDetector`, `ffiDetector`, `openapiDetector`, `buildRefDetector`,
  `sharedConfigDetector`) and `CrossEdge` endpoints (`shared/src/types/project.ts:152-157`):
  add `module: <id>` to endpoints while keeping `ecosystem` for display; update the dedup
  key in `crosslang/index.ts:83`. `sharedConfigDetector` rekeys `moduleVarsMap` to id.

**7. ws/protocol — lookups by id**
- `ws/protocol.ts`: change the six `modules.find((m) => m.path === modulePath)` sites
  (≈709,737,892,959,1025,1100) to `m.id === moduleId`; lock get/set/delete (≈902,907,938)
  key on `moduleId`; `MODULE_NOT_FOUND` reports the `moduleId`. `module_updated` already
  returns the full `Module` (now with `id`).

**8. ui — selection, keys, request targeting by id**
- `stores/viewStore.ts`: `selectedModulePath` → `selectedModuleId`; validity `Set` from
  `m.id`; `selectModule(id)`.
- `stores/projectStore.ts`: `updateModule`/`updateDependency` match on `m.id === updated.id`.
- `stores/actionStore.ts`: `inProgress` map keyed by `moduleId`.
- `lib/graphLayout.ts`: `moduleMap`, dagre `setNode`, `GraphLayoutNode.id` keyed by `mod.id`.
- `components/explorer/ModuleList.tsx`, `VirtualizedModuleList.tsx`: `key={mod.id}`,
  `isSelected={selectedModuleId === mod.id}`, `selectModule(mod.id)`; show path + ecosystem
  badge.
- `components/explorer/DependencyList.tsx`: find selected module by `m.id`.
- `hooks/useDependencyDetail.ts`: return `moduleId`; detail/install/update hooks and
  `InstallDialog.tsx` / `DependencyDetail.tsx` send `moduleId` in WS messages.
- `components/overview/ProjectOverview.tsx` `groupByEcosystem`: unchanged.

**9. tests**
- `discovery/moduleDiscovery.test.ts`: the two multi-manifest cases (≈53-66,157-166) now
  expect **2 modules** with split manifests; remove the "npm over pypi priority" assertion.
- `__tests__/graph/fixtures.ts` `createTestModule`: default `id` to `moduleId(path, ecosystem)`.
- `__tests__/graph/dependencyGraph.test.ts`: `graph.modules.get('packages/app')` →
  `.get('packages/app#npm')`.
- `__tests__/ws/protocol.test.ts`, `__tests__/actions/packageManager.test.ts`: mock modules
  gain `id`; request fixtures use `moduleId`.
- Add a discovery test: `package.json` + `Cargo.toml` in one dir ⇒ two modules with correct
  per-ecosystem manifests and ids.

### Suggested sequencing (keeps the build green between steps)

1. Add `Module.id` + `moduleId()` helper + schema, stamp it in `buildModule`, leave all
   keying on `path`.
2. Switch internal keying (graph, locks, protocol lookups, UI selection) from `path` to
   `id` while `id` is still unique (one ecosystem per dir).
3. Flip the wire field `modulePath`→`moduleId` (backend + UI together).
4. **Last:** remove `ECOSYSTEM_PRIORITY`/`pickPrimaryEcosystem` and emit one module per
   ecosystem. Only now does `path` become non-unique — every consumer is already id-keyed.
   Update the discovery tests.

### Edge cases & notes
- **Root module** (`path === "."`) ⇒ id `.#<ecosystem>`; preserve the `dir || '.'`
  normalization.
- **Lockfiles / secondary manifests** attach to their ecosystem via `detectEcosystem`;
  unrecognized ones are logged and dropped, as today.
- **ViewQuery module filter** stays path-based by design.
- **No external protocol consumers**: UI and backend ship together, so the
  `modulePath`→`moduleId` rename needs no compatibility shim.

### Verification
1. `pnpm build && pnpm test` from repo root.
2. New/updated discovery unit tests prove a mixed directory yields N modules (one per
   ecosystem) with correctly partitioned manifests and ids.
3. Manual E2E: scratch dir with `package.json` + `pyproject.toml`, `pnpm dev`, scan, and
   confirm both an npm and a pypi module appear (separate rows, same path, distinct
   badges); each lists only its own deps; `analyze_imports` and install/update/remove on
   **each** module succeed and lock independently.
4. Cross-language graph still renders; an edge touching the split directory resolves to the
   correct ecosystem endpoint.
5. Run `everything-claude-code:code-reviewer` and `everything-claude-code:security-reviewer`
   (WS protocol surface changed); address CRITICAL/HIGH findings.
