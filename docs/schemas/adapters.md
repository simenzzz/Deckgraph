# Adapter Schema

> **Canonical source:** `packages/shared/src/types/adapters.ts`
> **Last verified:** Pre-implementation (schema designed, not yet coded)

The adapter system uses the Strategy Pattern to support multiple language ecosystems without modifying core scanner or graph code. Each adapter bundles three capabilities: manifest parsing, import analysis, and registry queries.

## EcosystemAdapter

```typescript
interface EcosystemAdapter {
  /** Which ecosystem this adapter handles */
  readonly ecosystem: Ecosystem

  /** Manifest file names to look for during discovery (e.g. ["package.json"]) */
  readonly manifestFiles: readonly string[]

  /** File extensions this adapter can analyze for imports (e.g. [".ts", ".tsx"]) */
  readonly sourceExtensions: readonly string[]

  /**
   * Phase 1: Parse manifest + lock files to extract declared dependencies.
   * Async because it reads files from disk — avoid blocking the event loop
   * during startup scan of large monorepos.
   */
  parseManifests(projectRoot: string, modulePath: string): Promise<ManifestResult>

  /**
   * Phase 2: AST-parse a single source file to extract imports.
   * Expensive — called on-demand when user drills into a module.
   */
  analyzeImports(filePath: string, source: string): readonly ParsedImport[]

  /**
   * Phase 3: Query the ecosystem's package registry for metadata.
   * Network-bound — called on-demand when user opens dependency detail.
   */
  queryRegistry(packageName: string): Promise<RegistryMeta | null>
}
```

## ManifestResult

Returned by `parseManifests`. Contains everything extractable from config/lock files without touching source code.

```typescript
interface ManifestResult {
  /** Detected module name (from manifest metadata or directory name) */
  readonly moduleName: string
  /** Declared dependencies with versions and scopes */
  readonly dependencies: readonly MinimalDependency[]
  /** Lock file found and parsed (enables precise version resolution) */
  readonly hasLockFile: boolean
  /** Ecosystem-specific extras (e.g. npm scripts, Python extras, Go module path) */
  readonly metadata: Readonly<Record<string, unknown>>
}
```

## MinimalDependency

Minimal dependency representation returned by adapters during manifest parsing. Adapters only know about these 4 fields at parse time; the full `Dependency` type has additional fields (`ecosystem`, `source`, `concerns`, `usedInFiles`, `transitiveDeps`, `registryMeta`) populated during later analysis phases.

```typescript
interface MinimalDependency {
  /** Package name as the ecosystem knows it */
  readonly name: string
  /** Resolved/installed version */
  readonly version: string
  /** Raw constraint string (semver, PEP 440, Cargo req, etc.) */
  readonly constraint: string
  /** Generalized scope */
  readonly scope: DependencyScope
}
```

## ParsedImport

A single import statement extracted from source code via AST analysis.

```typescript
interface ParsedImport {
  /** Import source (e.g. "stripe", "flask", "github.com/gin-gonic/gin") */
  readonly source: string
  /** Imported names (e.g. ["Stripe", "default"], ["Flask", "jsonify"]) */
  readonly specifiers: readonly string[]
  /** true if this is a third-party package import (not relative/local) */
  readonly isThirdParty: boolean
  /** Line number in source file */
  readonly line: number
}
```

## ImportPackageMap

Resolves import source strings to their declared package names. Required for accurate unused dependency detection in ecosystems where import names differ from package names.

```typescript
interface ImportPackageMap {
  /**
   * Resolve an import source to its package name.
   * Returns null if no mapping exists (assumes 1:1 import-to-package).
   */
  resolvePackageName(importSource: string, ecosystem: Ecosystem): string | null
}
```

**Known mismatches by ecosystem:**

| Ecosystem | Import | Package | Notes |
|-----------|--------|---------|-------|
| Python | `PIL` | `Pillow` | Image processing |
| Python | `cv2` | `opencv-python` | Computer vision |
| Python | `yaml` | `PyYAML` | YAML parsing |
| Python | `sklearn` | `scikit-learn` | Machine learning |
| Java | `org.apache.commons.lang3.*` | `commons-lang3` | Import hierarchy → Maven artifact |
| Go | import path | module name | Handle `replace` directives in `go.mod` |
| JS/TS | `@types/*` | runtime package | Type-only packages map to runtime counterparts |

The mapping is a curated database (similar to concern tags) with ecosystem-specific heuristics as fallback.

## AdapterRegistry

Maps file extensions and manifest files to the correct adapter.

```typescript
interface AdapterRegistry {
  /** Register an adapter for its ecosystem */
  register(adapter: EcosystemAdapter): void

  /** Get the adapter that handles a given manifest file (e.g. "package.json" → JS/TS adapter) */
  getAdapterForManifest(manifestFileName: string): EcosystemAdapter | null

  /** Get the adapter that handles a given source file extension (e.g. ".py" → Python adapter) */
  getAdapterForExtension(extension: string): EcosystemAdapter | null

  /** List all registered ecosystems */
  getRegisteredEcosystems(): readonly Ecosystem[]
}
```

## Design Rules

1. **All scanning goes through the registry** — Never call `@babel/parser` or `web-tree-sitter` directly from scanner code
2. **Adding a new ecosystem = implementing `EcosystemAdapter` + registering it** — Zero changes to existing code
3. **Adapters are stateless** — They receive paths/source and return data. No side effects
4. **Phases are independent** — Phase 2 can run without Phase 3 and vice versa

## Per-Ecosystem Details

### JavaScript / TypeScript

| Property | Value |
|----------|-------|
| Manifest files | `package.json` |
| Lock files | `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock` |
| Source extensions | `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs` |
| Import analysis | `@babel/parser` — pure JS, zero native deps |
| Registry | npm API (`registry.npmjs.org`) |
| Scopes | `runtime`, `dev`, `peer`, `optional` |
| Constraint syntax | semver ranges (`^1.2.3`, `~1.2.3`, `>=1.0.0`) |

| Manifest | Analysis Reliability |
|----------|---------------------|
| `package.json` | Full (declarative JSON) |

### Python

| Property | Value |
|----------|-------|
| Manifest files | `pyproject.toml`, `setup.cfg`, `requirements.txt`, `Pipfile`, `setup.py` |
| Lock files | `poetry.lock`, `Pipfile.lock`, `requirements.txt` (pinned) |
| Source extensions | `.py`, `.pyi` |
| Import analysis | `web-tree-sitter` (`tree-sitter-python`) |
| Registry | PyPI JSON API (`pypi.org/pypi/{name}/json`) |
| Scopes | `runtime`, `dev`, `build`, `optional` (extras) |
| Constraint syntax | PEP 440 (`>=1.0,<2.0`, `~=1.4.2`, `==1.0.*`) |

| Manifest | Analysis Reliability |
|----------|---------------------|
| `pyproject.toml` | Full (declarative TOML) |
| `requirements.txt` | Full (line-based) |
| `setup.cfg` | Full (declarative INI) |
| `Pipfile` | Full (declarative TOML) |
| `setup.py` | Partial — static extraction only, dynamic deps may be missed. Projects using `setup.py` should migrate to `pyproject.toml` or provide a `requirements.txt`. |

### Go

| Property | Value |
|----------|-------|
| Manifest files | `go.mod` |
| Lock files | `go.sum` |
| Source extensions | `.go` |
| Import analysis | `web-tree-sitter` (`tree-sitter-go`) |
| Registry | Go module proxy (`proxy.golang.org`) |
| Scopes | `runtime` (Go has no dev dependency concept) |
| Constraint syntax | Module versions (`v1.2.3`, `v0.0.0-timestamp-hash`) |

| Manifest | Analysis Reliability |
|----------|---------------------|
| `go.mod` | Full (declarative) |

### Rust

| Property | Value |
|----------|-------|
| Manifest files | `Cargo.toml` |
| Lock files | `Cargo.lock` |
| Source extensions | `.rs` |
| Import analysis | `web-tree-sitter` (`tree-sitter-rust`) |
| Registry | crates.io API (`crates.io/api/v1/crates/{name}`) |
| Scopes | `runtime`, `dev`, `build` |
| Constraint syntax | Cargo version reqs (`^1.2.3`, `~1.2`, `>=1,<2`) |

| Manifest | Analysis Reliability |
|----------|---------------------|
| `Cargo.toml` | Full (declarative TOML) |

### Java

| Property | Value |
|----------|-------|
| Manifest files | `pom.xml`, `build.gradle`, `build.gradle.kts` |
| Lock files | `gradle.lockfile` (Gradle), effective POM (Maven) |
| Source extensions | `.java`, `.kt`, `.kts` |
| Import analysis | `web-tree-sitter` (`tree-sitter-java`) |
| Registry | Maven Central (`search.maven.org`) |
| Scopes | `runtime` (compile), `dev` (test), `build` (provided), `optional` |
| Constraint syntax | Maven version ranges (`[1.0,2.0)`, `1.2.3`) |

| Manifest | Analysis Reliability |
|----------|---------------------|
| `pom.xml` | High — parent POM inheritance and property interpolation not fully resolved |
| `build.gradle` / `.kts` | Partial — static extraction only, Groovy/Kotlin DSL logic not evaluated. Gradle users can generate a POM via `gradle generatePomFileForMavenJavaPublication` or use `gradle.lockfile`. |

---

## Related Links

- [ARCHITECTURE.md](../ARCHITECTURE.md) — System overview, adapter system description
- [Project Schema](./project.md) — Types that adapters produce
- [ADR-003](../adr/003-tree-sitter-unified-parser.md) — Why web-tree-sitter for non-JS/TS parsing
