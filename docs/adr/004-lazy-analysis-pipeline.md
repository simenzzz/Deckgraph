# ADR-004: Lazy analysis pipeline

**Status:** Accepted

## Context

Deckgraph targets large monorepos with potentially hundreds of modules across five ecosystems. A full upfront scan — manifest parsing, AST import analysis, and registry queries for every module — would take minutes and block the UI.

Users want to see an overview immediately, then drill into specific modules or dependencies on demand.

## Decision

Split analysis into four phases with increasing cost, where only Phases 0–1 run on startup and Phases 2–3 run on-demand:

| Phase | What | Cost | Trigger |
|-------|------|------|---------|
| 0: Discovery | Walk filesystem, detect modules and ecosystems | Instant | Startup |
| 1: Manifest Scan | Parse manifests + lock files → declared deps | Seconds | Startup |
| 2: Import Analysis | AST-parse source files → `usedInFiles`, unused detection | Per module (seconds) | User drills into module |
| 3: Registry Enrichment | Query registry APIs → latest versions, licenses | Per dep (network-bound) | User opens dep detail |

**Reasons:**
- **Phase 0+1 must complete in under 5 seconds** for a monorepo with 50 modules — manifest/lock file parsing is cheap
- **Phase 2 is the expensive one** — AST-parsing every source file in a large module can take seconds. Only worth doing when the user explicitly cares about that module
- **Phase 3 is network-bound** — registry queries add latency and rate limiting. Batch and cache, only when needed
- **The `analysisState` field on `Module`** makes the lazy state explicit — the UI knows what data is available and can prompt the user to "Analyze imports" or "Check for updates"

## Consequences

- **Positive:** Sub-5-second startup for any size monorepo
- **Positive:** Network usage is proportional to user interest, not project size
- **Positive:** UI can show useful data immediately (dep counts, versions, scopes) without waiting for expensive analysis
- **Negative:** Some views (unused deps, exact import locations) require the user to trigger Phase 2 first
- **Negative:** Stale `analysisState` requires tracking — if files change, a module may need re-analysis
- **Mitigated:** File watcher with content hashing invalidates `analysisState` on relevant file changes
