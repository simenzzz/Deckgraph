# Deckgraph Documentation

## Architecture

- [ARCHITECTURE.md](./ARCHITECTURE.md) — System overview, adapter system, layered views, lazy pipeline, cross-language edges

## Schemas

- [Project](./schemas/project.md) — Project, Module, Dependency, CrossEdge, WebSocket messages
- [Adapters](./schemas/adapters.md) — EcosystemAdapter interface, per-ecosystem details
- [Views](./schemas/views.md) — ViewQuery, ViewResult, ViewSummary

## Architecture Decision Records

- [ADR-001: Babel over tree-sitter](./adr/001-babel-over-treesitter.md) *(Superseded by ADR-003)*
- [ADR-002: Zustand over Redux](./adr/002-zustand-over-redux.md)
- [ADR-003: tree-sitter as unified parser](./adr/003-tree-sitter-unified-parser.md)
- [ADR-004: Lazy analysis pipeline](./adr/004-lazy-analysis-pipeline.md)

## Archive

Previous architectures (prompt co-pilot, JS-only dependency UI) are preserved in [archive/](./archive/) for reference.
