# Deckgraph Codebase Audit

## Status: 2,200 lines of documentation, 0 lines of code

The documentation quality is genuinely impressive — schema-first design, ADRs for every major decision, clear separation of concerns, consistent cross-references. This is better pre-implementation documentation than most shipped products have post-implementation. That said, documentation quality and implementation feasibility are different things.

---

## What's Strong

1. **The problem is real and unserved.** No existing tool unifies dependency graphs across JS/TS, Python, Go, Rust, and Java. Dependency-cruiser is JS-only. Nx/Turborepo track internal monorepo structure, not external packages. The competitive gap is genuine.

2. **Lazy analysis pipeline (ADR-004) is the right call.** Splitting into discovery → manifest → imports → registry with on-demand Phase 2/3 is exactly how you make this usable on large repos. This is the most important architectural decision and it's correct.

3. **Adapter pattern is clean.** Strategy pattern with `EcosystemAdapter` interface means adding a 6th language doesn't touch existing code. The interface is minimal and well-defined.

4. **Backend-as-source-of-truth + Zustand caches** is the right state model for this kind of tool. No optimistic updates means no consistency bugs.

5. **Error format `{type, message, suggestion}`** is user-friendly and forces discipline.

---

## Critical Issues

### 1. Phase 1 scope is 3x too large

Phase 1 currently includes:
- Monorepo setup
- ALL 5 ecosystem adapters (JS/TS, Python, Go, Rust, Java)
- Unified dependency graph
- Query engine
- Cross-language edge detection (Proto + FFI)
- Concern tag database
- Full UI (Overview, Module Explorer, filters)
- End-to-end `npx stratum` distribution

This is not a "foundation phase." This is the entire product minus some Phase 2 deep-analysis features. A realistic Phase 1 should be **JS/TS adapter + graph + basic UI**. Maybe Python as a second adapter. Ship something that works for one ecosystem before trying five.

### 2. `parseManifests` is synchronous — it shouldn't be

The adapter interface defines:
```typescript
parseManifests(projectRoot: string, modulePath: string): ManifestResult
```

This reads files from disk. In Node.js, disk I/O should be async. When scanning 200+ modules on startup, synchronous file reads will block the event loop and delay the WebSocket server from accepting connections. This should return `Promise<ManifestResult>`.

### 3. Import name ≠ package name (not addressed anywhere)

This is a showstopper for import analysis accuracy:
- Python: `import PIL` → package `Pillow`. `import cv2` → package `opencv-python`. `import yaml` → package `PyYAML`. `import sklearn` → package `scikit-learn`.
- Go: Import paths like `github.com/gin-gonic/gin` map to module `gin`, but the mapping is often non-obvious with replace directives.
- Java: `import com.google.gson.Gson` → package `com.google.code.gson:gson`. The import package hierarchy doesn't match the Maven artifact coordinates.
- Rust: `use serde` could be `serde` or `serde_json` depending on features.

Without an import-name-to-package-name mapping layer, your "unused dependency detection" will be wildly inaccurate. The docs don't mention this problem at all.

### 4. `setup.py` is executable Python — you can't parse it from Node.js

The Python adapter lists `setup.py` as a manifest file. But `setup.py` is a Python script, not a config file. Many `setup.py` files dynamically compute their dependency lists:

```python
import os
deps = ["flask"]
if os.environ.get("USE_POSTGRES"):
    deps.append("psycopg2")
setup(install_requires=deps)
```

You cannot statically extract dependencies from this in Node.js. You'd need to either: (a) shell out to Python to evaluate it, (b) use regex heuristics (unreliable), or (c) skip `setup.py` entirely and only support `pyproject.toml`/`requirements.txt`. The docs don't acknowledge this limitation.

### 5. `build.gradle` is code, not config

Same problem as `setup.py`. Gradle build files are Groovy or Kotlin DSL scripts. They can have conditional logic, variable interpolation, custom plugins, and dynamic dependency declarations. Static parsing of `build.gradle` is an unsolved problem in the Java ecosystem — even Gradle itself evaluates them by running the JVM.

`pom.xml` is more tractable (it's XML) but still has parent POM inheritance and property interpolation (`${project.version}`).

### 6. Lock file format complexity is underestimated

Each lock file format has multiple versions:
- `pnpm-lock.yaml`: v5, v6, v9 — structurally different
- `package-lock.json`: v1, v2, v3 — different `packages` vs `dependencies` keys
- `yarn.lock`: Classic v1 vs Berry v2+ — completely different formats
- `poetry.lock`: Format changes across Poetry versions
- `Cargo.lock`: v1, v2, v3, v4 — different hashing schemes

Parsing "lock files" is actually parsing 15+ distinct formats. Each is a multi-day implementation effort. The docs treat them as simple items in a table.

### 7. Cross-language edge detection confidence is overestimated

The docs list FFI detection as "High (0.9+)" confidence. This is unrealistic.

- **PyO3**: You need to find `#[pymodule]` in Rust code AND match it to the corresponding Python import. The generated module name doesn't always match the crate name.
- **cgo**: `import "C"` is easy to find, but the actual C library being called requires parsing the `#cgo` directives and matching to system libraries.
- **JNI**: `System.loadLibrary("name")` is string-based. The `.so`/`.dll` name doesn't map to any module in your graph.
- **napi**: N-API addons are loaded via `require()` calls that look identical to normal Node module imports.

Realistic confidence for FFI detection: **0.4–0.6**, not 0.9+. The Proto detector is more feasible (0.7–0.8), but still requires matching `.proto` package names to generated code locations.

### 8. No rate limiting strategy for 5 registry APIs

npm, PyPI, crates.io, Go proxy, and Maven Central all have different rate limits:
- npm: ~100 req/s for the public registry
- PyPI: Undocumented, but they'll throttle aggressive scrapers
- crates.io: Requires `User-Agent`, 1 req/s recommendation
- Go proxy: Generally permissive but can block
- Maven Central: No explicit limit but search API is slow

The docs say "batch and cache" but specify no actual caching strategy (TTL? LRU? Disk-persisted?). For a monorepo with 500+ unique dependencies, the registry enrichment phase could trigger thousands of API calls.

---

## Feasibility Verdict

**The core concept is feasible and valuable.** A well-executed dependency visualizer for polyglot monorepos would fill a real gap.

**Phase 1 as currently scoped is NOT feasible as a single phase.** It's 3–6 months of work for a solo developer across 5 ecosystems, cross-language detection, and a full UI. The risk of abandonment is high when you're 2 months in and still fighting Python manifest parsing edge cases.

**The hardest parts are in the adapter implementations, not the architecture.** The architecture is sound. The difficulty is in the 100+ format-specific edge cases across 5 ecosystems and their manifest/lock file variants.

---

## Recommended Architectural Changes

### 1. Make Phase 1 = JS/TS only (or + Python at most)

JS/TS alone covers the majority of monorepo users. It validates the architecture, the UI, the graph, and the pipeline with ONE well-tested adapter. Add Python in Phase 1.5, Go/Rust/Java in Phase 2+.

### 2. Make `parseManifests` async

```typescript
// Current (blocking)
parseManifests(projectRoot: string, modulePath: string): ManifestResult

// Should be
parseManifests(projectRoot: string, modulePath: string): Promise<ManifestResult>
```

This allows parallel manifest parsing across modules and doesn't block the event loop.

### 3. Add an import-to-package mapping layer

You need a mapping database (similar to the concern tag database) that maps import names to package names:

```typescript
interface ImportPackageMap {
  resolvePackageName(importSource: string, ecosystem: Ecosystem): string | null
}
```

For Python this is essential (`PIL` → `Pillow`). For JS/TS it's mostly 1:1 but not always (e.g., `@types/*` packages). Without this, unused dependency detection is unreliable.

### 4. Drop cross-language edge detection from Phase 1

This is the hardest feature with the least initial value. Users first want to see "what does my project depend on?" — not "how does my Python service connect to my Rust library." Add it in Phase 2 after the core dependency views work.

### 5. Drop concern tags from Phase 1

A curated package→concern mapping is nice but not core. Ship without it, see if users actually request it. Add it later with community contributions.

### 6. Use `web-tree-sitter` (WASM) instead of native tree-sitter

The ADR acknowledges native deps as a downside and WASM as a fallback. I'd argue: **start with WASM.** The performance difference is negligible for on-demand import analysis (Phase 2 is already lazy). Native tree-sitter adds:
- Platform-specific prebuilt binaries (~100MB+ total)
- `node-gyp` compilation failures on user machines
- CI complexity for cross-platform builds

WASM eliminates all of this. If profiling later shows WASM is too slow, switch to native. But don't pay the distribution cost upfront for a performance problem you might not have.

### 7. Drop `setup.py` and `build.gradle` support initially

Only support declarative manifest formats you can parse statically:
- Python: `pyproject.toml`, `requirements.txt` (these cover 90%+ of modern Python projects)
- Java: `pom.xml` only (most Maven projects; Gradle users can generate effective POM)

Acknowledge the limitation in docs. Don't silently produce wrong results for dynamic manifests.

### 8. Add memory budget / repo size limits

Document a target: "Stratum targets monorepos with up to 200 modules." Add a warning when discovery finds more. Plan for disk-backed storage (SQLite) in a future phase if demand exists.

---

## Other Issues Worth Noting

- **No CI/CD plan.** No `.github/workflows/`, no mention of how the tool itself is tested/released.
- **No versioning strategy.** No mention of semver for the WebSocket protocol or how breaking changes are communicated.
- **`stale plan file: memoized-mapping-cupcake.md`** in `.claude/plans/` describes the old prompt co-pilot architecture. Should be cleaned up.
- **Memory note in MEMORY.md** still references `@vibekit/` package names (old product name) in the package structure section, while docs use `@stratum/`.
- **No `.gitignore`** exists yet — will need one before any code is committed.
- **Concern View** appears in the architecture diagram but isn't specified in the view schema (`views.md`).

---

## Summary

| Area | Assessment |
|------|-----------|
| Documentation quality | Excellent — better than most shipped products |
| Architecture design | Sound — lazy pipeline, adapter pattern, backend-as-truth |
| Phase 1 scope | Too large by ~3x — should be 1-2 ecosystems, no cross-lang, no concern tags |
| Adapter complexity | Severely underestimated — manifest/lock formats are a minefield |
| Import analysis | Missing critical import→package mapping layer |
| Cross-language detection | Confidence overestimated; should be Phase 2+ |
| Distribution (npx) | Feasible but WASM tree-sitter would simplify greatly |
| Feasibility (overall) | **Yes, with reduced Phase 1 scope.** Current Phase 1 = real Phase 1 + 2 + half of 3 |

The project is worth building. The architecture is good. The scope needs aggressive trimming to avoid the classic "ambitious project that never ships" failure mode. Ship JS/TS-only with a basic UI, prove the concept works, then expand.
