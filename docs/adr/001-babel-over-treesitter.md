# ADR-001: @babel/parser over tree-sitter for v1

**Status:** Superseded by [ADR-003](./003-tree-sitter-unified-parser.md)

> **Note:** `@babel/parser` is still used for JS/TS. ADR-003 adopts web-tree-sitter (WASM) as the unified parser for Python, Go, Rust, and Java. The `LanguageParser` interface is replaced by the broader `EcosystemAdapter` pattern.

## Context

Deckgraph needs to parse JavaScript and TypeScript source files to detect imports and build dependency graphs. Two mature options exist:

- **@babel/parser** — Pure JavaScript AST parser for JS/TS. Well-maintained, widely used, zero native dependencies.
- **tree-sitter** — Multi-language parser framework. Supports 50+ languages but requires native binaries (C/C++ compilation).

For v1, Deckgraph only needs JS/TS parsing. Future phases will add Python, Go, Rust, and Java.

## Decision

Use `@babel/parser` for v1. Adopt tree-sitter in Phase 1b when multi-language support is needed.

**Reasons:**
- **Zero native dependencies** — Simplifies installation via `npx deckgraph`, avoids build toolchain issues
- **JS/TS is sufficient for v1** — The first adapter handles JavaScript/TypeScript
- **Pluggable architecture** — The `EcosystemAdapter` interface means switching or adding parsers requires zero changes to existing tool code
- **Proven in the ecosystem** — Babel is the de facto standard for JS/TS AST work

## Consequences

- **Positive:** Simpler install, fewer CI/CD issues, faster startup
- **Positive:** Adapter registry design means tree-sitter can be added later without refactoring
- **Negative:** No Python/Go/Rust/Java support in Phase 1a (acceptable for Phase 1a scope)
- **Negative:** When tree-sitter is adopted in Phase 1b, WASM grammars add bundle size
