# Plan: Phase 1a — Monorepo Scaffold + Shared Types

## Goal
`pnpm install && pnpm build && pnpm test` all pass. `npx deckgraph` prints version.

---

## Key Decisions

### 1. ESM everywhere
- All packages use `"type": "module"` — Vite is ESM-native, modern Node.js standard
- TypeScript `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`
- Import paths include `.js` extension (required for ESM + NodeNext)

### 2. TypeScript project references
- Root `tsconfig.json` has `references` to all 3 packages
- Each package has its own `tsconfig.json` extending a shared base
- Turborepo handles build orchestration; TS project references ensure cross-package type checking

### 3. Types separate from Zod schemas
- `src/types/` — Clean TypeScript interfaces (matches docs exactly)
- `src/schemas/` — Zod schemas that validate the same shapes at runtime
- Type-level assertions (`satisfies`) ensure schemas stay in sync with interfaces
- Reason: docs define interfaces, Zod validates external data, both exist independently

### 4. What gets Zod schemas vs what doesn't
**Zod schemas (data that crosses system boundaries):**
- Ecosystem, AnalysisState, DependencyScope, CrossEdgeType (enums)
- Project, ProjectConfig, Module, Dependency, RegistryMeta, CrossEdge, CrossEdgeEndpoint
- ManifestResult, ParsedImport
- ViewQuery, ViewResult, ModuleView, ViewSummary
- All ClientMessage and ServerMessage variants

**No Zod (behavioral interfaces / internal-only):**
- EcosystemAdapter (interface with methods — not data)
- AdapterRegistry (interface with methods)
- ImportPackageMap (interface with methods)
- UnifiedGraph (uses ReadonlyMap/ReadonlySet — internal to backend)

### 5. Backend entry point
- `#!/usr/bin/env node` shebang in `src/index.ts`
- Build step strips TypeScript, preserves shebang
- `"bin": { "deckgraph": "./dist/index.js" }` in package.json
- Phase 1a: just reads own package.json version and prints it

---

## Implementation Steps

### Step 1: Root config files (no deps on anything)

**Files:**
- `package.json` — private workspace root, scripts: `build`, `test`, `dev`, `lint`, `clean`
- `pnpm-workspace.yaml` — `packages: ["packages/*"]`
- `turbo.json` — pipeline: build (depends on ^build), test, dev (persistent), clean
- `tsconfig.base.json` — shared compiler options (strict, ESM, target ES2022, declaration, declarationMap, sourceMap, skipLibCheck)
- `tsconfig.json` — references only (no files of its own)
- `.gitignore` — node_modules, dist, coverage, .turbo, *.tsbuildinfo
- `.npmrc` — `shamefully-hoist=false`, `strict-peer-dependencies=true`

### Step 2: packages/shared/ scaffold

**Files:**
- `packages/shared/package.json` — name: `@deckgraph/shared`, type: module, exports, dependencies: `zod`
- `packages/shared/tsconfig.json` — extends base, composite: true, outDir: dist, rootDir: src
- `packages/shared/vitest.config.ts`
- `packages/shared/src/index.ts` — barrel export (empty initially, filled after types)

### Step 3: Shared types — `packages/shared/src/types/`

All types transcribed exactly from schema docs. All fields `readonly`. All arrays `readonly`.

**3a: `types/project.ts`**
- `Ecosystem` type union
- `AnalysisState` type union
- `DependencyScope` type union
- `CrossEdgeType` type union
- `ProjectConfig` interface
- `Project` interface
- `Module` interface
- `Dependency` interface
- `RegistryMeta` interface
- `CrossEdgeEndpoint` interface
- `CrossEdge` interface
- `UnifiedGraph` interface (ReadonlyMap/ReadonlySet — backend-internal)

**3b: `types/adapters.ts`** (imports from project.ts)
- `EcosystemAdapter` interface (methods — no Zod)
- `ManifestResult` interface
- `ParsedImport` interface
- `ImportPackageMap` interface (method — no Zod)
- `AdapterRegistry` interface (methods — no Zod)

**3c: `types/views.ts`** (imports from project.ts)
- `ViewQuery` interface
- `ViewResult` interface
- `ModuleView` interface
- `ViewSummary` interface

**3d: `types/messages.ts`** (imports from project.ts, views.ts)
- `ScanProjectMessage`, `ViewQueryMessage`, `AnalyzeImportsMessage`, `EnrichDependencyMessage`, `SyncMessage`
- `ClientMessage` discriminated union
- `ProjectOverviewMessage`, `ViewResultMessage`, `ModuleUpdatedMessage`, `DependencyEnrichedMessage`, `ProgressMessage`, `ErrorMessage`
- `ServerMessage` discriminated union

### Step 4: Zod schemas — `packages/shared/src/schemas/`

Each schema file mirrors its type file. Export individual schemas + a combined `parse` function for each type. Use `z.object({...})` matching the interface. Use `satisfies` or `as const satisfies` to verify Zod output matches the TypeScript type.

**4a: `schemas/project.ts`**
- `EcosystemSchema` (z.enum)
- `AnalysisStateSchema` (z.enum)
- `DependencyScopeSchema` (z.enum)
- `CrossEdgeTypeSchema` (z.enum)
- `ProjectConfigSchema`, `ProjectSchema`, `ModuleSchema`, `DependencySchema`
- `RegistryMetaSchema`, `CrossEdgeEndpointSchema`, `CrossEdgeSchema`
- No schema for `UnifiedGraph` (internal, uses Map/Set)

**4b: `schemas/adapters.ts`**
- `ManifestResultSchema`, `ParsedImportSchema`
- No schemas for EcosystemAdapter, AdapterRegistry, ImportPackageMap (behavioral interfaces)

**4c: `schemas/views.ts`**
- `ViewQuerySchema`, `ViewResultSchema`, `ModuleViewSchema`, `ViewSummarySchema`

**4d: `schemas/messages.ts`**
- Individual schemas for each message type
- `ClientMessageSchema` (z.discriminatedUnion on `type`)
- `ServerMessageSchema` (z.discriminatedUnion on `type`)

### Step 5: Barrel export — `packages/shared/src/index.ts`

Re-export everything from types/ and schemas/. Organized sections:
```typescript
// Types
export type { Project, Module, Dependency, ... } from './types/project.js'
export type { EcosystemAdapter, ManifestResult, ... } from './types/adapters.js'
export type { ViewQuery, ViewResult, ... } from './types/views.js'
export type { ClientMessage, ServerMessage, ... } from './types/messages.js'

// Schemas
export { ProjectSchema, ModuleSchema, ... } from './schemas/project.js'
export { ManifestResultSchema, ... } from './schemas/adapters.js'
export { ViewQuerySchema, ... } from './schemas/views.js'
export { ClientMessageSchema, ServerMessageSchema, ... } from './schemas/messages.js'
```

### Step 6: packages/backend/ — Minimal entry point

**Files:**
- `packages/backend/package.json` — name: `@deckgraph/backend`, type: module, bin: `{ "deckgraph": "./dist/index.js" }`, depends on `@deckgraph/shared`
- `packages/backend/tsconfig.json` — extends base, composite: true, references shared
- `packages/backend/vitest.config.ts`
- `packages/backend/src/index.ts`:
  ```typescript
  #!/usr/bin/env node
  import { readFileSync } from 'node:fs'
  import { fileURLToPath } from 'node:url'
  import { dirname, join } from 'node:path'

  const __dirname = dirname(fileURLToPath(import.meta.url))
  const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'))
  console.log(`deckgraph v${pkg.version}`)
  ```

### Step 7: packages/ui/ — Placeholder

**Files:**
- `packages/ui/package.json` — name: `@deckgraph/ui`, type: module, depends on `@deckgraph/shared`
- `packages/ui/tsconfig.json` — extends base, placeholder

### Step 8: Tests

**`packages/shared/src/__tests__/schemas/project.test.ts`**
- Enum schemas accept valid values, reject invalid
- ProjectSchema, ModuleSchema, DependencySchema parse valid objects
- Reject missing required fields
- Reject wrong types
- Readonly arrays validated correctly
- Nullable fields (usedInFiles, registryMeta, etc.) accept null

**`packages/shared/src/__tests__/schemas/adapters.test.ts`**
- ManifestResultSchema parse/reject
- ParsedImportSchema parse/reject

**`packages/shared/src/__tests__/schemas/views.test.ts`**
- ViewQuerySchema accepts empty object (all optional)
- ViewQuerySchema accepts fully populated query
- ViewResultSchema parse/reject
- ViewSummarySchema parse/reject

**`packages/shared/src/__tests__/schemas/messages.test.ts`**
- ClientMessageSchema discriminates on `type` field
- ServerMessageSchema discriminates on `type` field
- Each message variant parses correctly
- Unknown type rejected
- Missing requestId rejected

**`packages/backend/src/__tests__/index.test.ts`**
- Version output test (mock console.log or capture stdout)

### Step 9: pnpm install + build + test

```bash
pnpm install
pnpm build        # Turborepo builds shared → backend → ui
pnpm test         # Vitest runs in all packages
```

---

## File Creation Order

```
1. Root configs        (.gitignore, .npmrc, package.json, pnpm-workspace.yaml, turbo.json, tsconfig.base.json, tsconfig.json)
2. shared/ scaffold    (package.json, tsconfig.json, vitest.config.ts)
3. shared/src/types/   (project.ts → adapters.ts → views.ts → messages.ts)
4. shared/src/schemas/ (project.ts → adapters.ts → views.ts → messages.ts)
5. shared/src/index.ts (barrel)
6. backend/ scaffold   (package.json, tsconfig.json, vitest.config.ts, src/index.ts)
7. ui/ scaffold        (package.json, tsconfig.json)
8. pnpm install
9. Tests               (schemas/*.test.ts, backend index.test.ts)
10. pnpm build && pnpm test
```

---

## Verification Checklist

- [ ] `pnpm install` succeeds (no dependency errors)
- [ ] `pnpm build` succeeds (TypeScript compiles all 3 packages)
- [ ] `pnpm test` succeeds (all Zod schema tests pass, 80%+ coverage on shared/)
- [ ] `node packages/backend/dist/index.js` prints version
- [ ] Types from shared are importable in backend and ui
- [ ] All type definitions match schema docs exactly (project.md, adapters.md, views.md)
- [ ] No `console.log` in shared package (only in backend entry point for version output)
- [ ] All fields are `readonly`
- [ ] ESM imports use `.js` extensions

---

## Risks

| Risk | Mitigation |
|------|-----------|
| Zod schemas drift from TypeScript interfaces | Type-level `satisfies` assertions at compile time |
| ESM + Node.js path resolution issues | Use `NodeNext` module resolution, test with `node --experimental-vm-modules` for vitest |
| Turbo cache invalidation | Clean builds during development: `pnpm clean && pnpm build` |
| `bin` field not working with workspace | Use `pnpm --filter @deckgraph/backend exec deckgraph` to test locally |
