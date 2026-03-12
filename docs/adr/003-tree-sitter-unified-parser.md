# ADR-003: tree-sitter as unified parser framework

**Status:** Accepted
**Supersedes:** [ADR-001](./001-babel-over-treesitter.md) (partially — Babel retained for JS/TS)

## Context

Deckgraph supports five language ecosystems: JavaScript/TypeScript, Python, Go, Rust, and Java. Each ecosystem needs AST-based import analysis to determine which third-party packages are actually used in source code (Phase 2 of the lazy analysis pipeline).

Options:
- **Per-language parsers** — Babel for JS/TS, a Python parser in JS, a Go parser in JS, etc. Fragmented, high maintenance.
- **tree-sitter** — One parser framework with grammar plugins for every language. Native dependency (C compilation), but a single API surface.
- **Regex-based** — Pattern matching on import statements. Fast but unreliable (comments, string literals, multi-line imports).

## Decision

Use **`web-tree-sitter` (WASM)** as the unified parser framework for Python, Go, Rust, and Java. **Retain `@babel/parser` for JS/TS** — it's already battle-tested, pure JS, and switching adds risk with no benefit.

**Reasons:**
- **One framework, five grammars** — tree-sitter grammars exist and are well-maintained for all five target languages
- **Consistent API** — Same tree/node/query interface regardless of language. Adapter code follows a uniform pattern
- **Zero native deps** — WASM binaries work everywhere without `node-gyp` or platform-specific compilation, critical for `npx deckgraph` just-works distribution
- **Performance cost acceptable** — Import analysis is on-demand (Phase 2 of lazy pipeline), not on the startup critical path. WASM overhead is negligible for per-module analysis
- **Babel for JS/TS is pragmatic** — Babel is the de facto standard for JS/TS AST work, has zero native deps, and is already proven in this codebase. No reason to replace it

## Consequences

- **Positive:** Uniform adapter pattern — each non-JS adapter follows the same tree-sitter query structure
- **Positive:** Adding a sixth language (Ruby, C#, etc.) is just another grammar plugin
- **Positive:** Zero native dependencies — `npx deckgraph` works on any platform without compilation toolchain
- **Negative:** WASM parsing is slower than native tree-sitter bindings (~2-3x overhead)
- **Mitigated:** Performance cost is acceptable because import analysis runs on-demand per module, not at startup. If profiling reveals WASM as a bottleneck in Phase 4b, native bindings can be added as an optional optimization
