# Plan: Apply Review Recommendations to Docs

## Context
After reviewing all Deckgraph documentation, the user agreed with all recommendations except one: keep all 5 cross-language detectors (don't reduce to Proto + FFI only). This plan applies the agreed changes to the implementation roadmap, CLAUDE.md, views schema, ADR-003, and ARCHITECTURE.md.

---

## Changes Summary

### 1. `docs/implementation_roadmap.md` — Restructure Phase 1

**Phase 1d: Drop WS auth**
- Remove session cookie auth from Phase 1d
- Replace with: `ws` server bound to `127.0.0.1` only, no auth (localhost trust)
- Update resolved decisions section: WS auth deferred to later phase

**Phase 1e: Merge Module Explorer into UI Skeleton**
- Rename to "UI Skeleton + Overview + Module Explorer"
- Move Module Explorer UI components (ModuleList, DependencyList, FilterBar, useViewQuery) from Phase 1f into 1e
- This makes 1e the full JS/TS vertical slice including exploration

**Phase 1f: All remaining adapters together**
- Rename to "Python + Go + Rust + Java Adapters"
- Move Python adapter from old 1f here
- Move Go/Rust/Java adapters from old 1g here
- Manifest parsing only — no cross-lang, no concern tags

**Phase 1g: Cross-Language Edges + Concern Tags**
- Keep all 5 detectors (Proto, FFI, OpenAPI, build refs, shared config)
- Keep concern tagger
- UI updates for cross-edge display and concern filter
- This is now a focused "detection + tagging" phase, not mixed with adapter work

**Update dependency chain diagram and intro line** (now 7 sub-phases still, but differently scoped)

**Update Resolved Decisions section** — WS auth changed from cookie to deferred

### 2. `docs/schemas/views.md` — Define depth semantics

Add a clarification comment to the `depth` field in ViewQuery:
```
depth=1 means direct dependencies only.
depth=N means include transitive dependencies up to N hops.
depth=undefined means no transitive expansion (direct deps only, same as depth=1).
```

### 3. `docs/adr/003-tree-sitter-unified-parser.md` — Commit to WASM

Change the "Mitigated" consequence from "can switch later" to an explicit decision:
- **Decision:** Use `web-tree-sitter` (WASM) — zero native deps, works everywhere via `npx`
- Remove the "can switch later" hedge
- Add rationale: performance cost acceptable since import analysis is on-demand (Phase 2)

### 4. `docs/ARCHITECTURE.md` — Two changes

**a) Security model:** Replace "auth token on startup" with "localhost-only binding (127.0.0.1), no auth in Phase 1. Auth deferred until remote access is needed."

**b) Tech stack table:** Change "tree-sitter" to "web-tree-sitter (WASM)" with updated rationale

### 5. `.claude/CLAUDE.md` — Update Phase 1 checklist

Adjust the Phase 1 checklist items to match the new roadmap structure. No structural changes to other sections.

### 6. `docs/schemas/project.md` — Add analysisState invalidation rules

Add a paragraph after the AnalysisState type definition explaining:
- File changes in a module's directory invalidate analysisState back to `manifest-only`
- UI shows a stale indicator; user must re-trigger analysis
- Manifest file changes trigger re-parse (back to `manifest-only`)
- Source file changes invalidate `imports-resolved` back to `manifest-only`

---

## Files to modify
1. `docs/implementation_roadmap.md` — Phase 1 restructure + WS auth deferral
2. `docs/schemas/views.md` — depth semantics (line 24)
3. `docs/adr/003-tree-sitter-unified-parser.md` — commit to WASM (line 32)
4. `docs/ARCHITECTURE.md` — security model (line 321) + tech stack (line 123)
5. `.claude/CLAUDE.md` — Phase 1 checklist (lines 57-73)
6. `docs/schemas/project.md` — analysisState rules (after line 61)

## Verification
- All internal doc cross-references still resolve
- Phase 1 dependency chain is still linear and logical
- No contradictions between CLAUDE.md, roadmap, and schema docs
- ADR-003 is unambiguous about WASM
