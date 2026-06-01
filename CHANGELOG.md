# Changelog

## v1.0.0 — 2026-05-28

Initial public release.

### Features

- Multi-language dependency graph across JS/TS, Python, Go, Rust, and Java
- Unified graph view with cross-language edge detection (proto, FFI, OpenAPI, build references, shared config)
- Interactive web UI with filterable, virtualized dependency lists
- On-demand deep analysis: import-level resolution, registry metadata, concern tagging
- Package management actions (install, update, remove) with per-module locking and rollback
- Workspace mode for monorepos with multiple project roots
- VS Code extension with tree view, CodeLens, and file decorations
- Hosted demo mode with curated public GitHub repository imports
- WebSocket-based streaming with batched updates and scan progress notifications
