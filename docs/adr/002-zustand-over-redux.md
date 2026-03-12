# ADR-002: Zustand over Redux for UI State

**Status:** Accepted

## Context

The Deckgraph UI needs client-side state management. The state model is simple: three stores (`projectStore`, `viewStore`, `filterStore`) that are caches of server-pushed data. There are no complex client-side state transitions or middleware chains.

Options considered:
- **Redux** — Industry standard, excellent devtools, but verbose boilerplate
- **Zustand** — Lightweight, minimal API, works well with server-pushed state

## Decision

Use Zustand for all UI state management.

**Reasons:**
- **Server-pushed model** — Stores are caches, not independent state machines. Zustand's simplicity matches this pattern.
- **Minimal boilerplate** — No actions, reducers, or dispatch. Just `set()` and `get()`.
- **Small bundle size** — ~1KB vs Redux's ~7KB (plus middleware)
- **React 19 compatibility** — First-class support

## Consequences

- **Positive:** Less code to write and maintain, faster onboarding for contributors
- **Positive:** Natural fit for "backend pushes state, UI reflects it" pattern
- **Negative:** Less structured than Redux for complex state logic (not needed here)
- **Negative:** Fewer devtools compared to Redux DevTools (acceptable trade-off)
