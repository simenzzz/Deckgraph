# Deckgraph

## Project Overview

Deckgraph is a **multi-language dependency exploration and audit tool** for large codebases. It scans a monorepo, auto-detects modules across ecosystems (JS/TS, Python, Go, Rust, Java), builds a unified dependency graph with cross-language edges, and presents layered, filterable views through an interactive web interface.

**Core value proposition:** A visual tool that answers: "What libraries does this codebase depend on? Across which languages? Where are they used? Are any outdated or unused? How do the different parts connect?" — all filterable to avoid hairball views, with on-demand deep analysis to stay fast.

---

## Architecture

Two-tier system: **Web UI** (React) communicates over WebSocket with a **Backend** (Node.js). The backend scans the monorepo, builds a unified dependency graph across all ecosystems, and pushes filtered views to the UI.

No MCP protocol, no LLM, no stdio transport. One backend process.

See [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) for component design, diagrams, tech stack, project structure, and security model.

### Package Structure

```
packages/
├── backend/     # Node.js server (adapters, graph, query engine, WS server, actions)
├── ui/          # Web frontend (React 19 + Vite + shadcn/ui)
└── shared/      # Shared types & utilities (sole cross-package dependency)
```

---

## Current Phase

**Phase 3: Management** (In Progress)

- [x] 3a: Package update from UI (executors, validators, manifest backup, rollback)
- [x] 3b: Install + remove + batch operations
- [ ] 3c: Polyrepo support + developer hooks

Phases 1-2 complete. Full roadmap: [docs/implementation_roadmap.md](../docs/implementation_roadmap.md)

**When updating this section:** Check off completed items and update the roadmap file.

---

## Workflow Rules

1. **Always run code-reviewer agent** immediately after writing or modifying code — before presenting results to the user
2. **Fix CRITICAL and HIGH issues** from code review before considering work complete
3. **Run `pnpm build && pnpm test`** after every set of changes to verify nothing is broken
4. **Use incremental scan** (`incrementalScan`) instead of full `scanProject` when only specific modules changed

---

## Error Handling

All errors surfaced to the UI must follow this format:

```typescript
{
  type: "error",
  message: string,    // Plain-language: "what happened"
  suggestion: string  // Plain-language: "what to do about it"
}
```

Never expose stack traces, error codes, or technical jargon in user-facing messages. Use `pino` for all logging. Never log secrets.

---

## Deckgraph-Specific Conventions

General coding style, security, testing, and hook rules are defined in `.claude/rules/`. The following are **Deckgraph-specific** conventions:

### Naming

- `camelCase` for variables, functions, file names (non-component)
- `PascalCase` for types, interfaces, classes, React components, component file names
- Package names use `@Deckgraph/` scope: `@Deckgraph/backend`, `@Deckgraph/ui`, `@Deckgraph/shared`

### Package Boundaries

- `packages/shared/` is the **only** package that other packages may depend on for types
- UI must **never** import from backend directly
- All UI-to-backend communication goes through the WebSocket protocol

### Adapter vs Executor Pattern

- **Adapters** are stateless and read-only — input data, return results, no side effects. Each in its own directory under `adapters/`
- **Executors** handle write operations (package install/update/remove) via subprocess calls. Each in `actions/executors/`
- All scanning goes through `AdapterRegistry` — never call parsers directly
- All package mutations go through `packageManager.ts` facade — never call executors directly

### External Data Validation

All external data is Zod-validated: registry API responses, user WebSocket messages, parsed manifest content. Never trust external data.

### Security Conventions

- **Subprocess execution:** Always use `execa` without shell (`shell: false`), array args, 60s timeout. Never interpolate user input into shell strings
- **Input validation:** Validate both `packageName` and `version` with allowlist regexes before any executor call. Export validators for reuse
- **XML manipulation:** Always escape with `escapeXml()` when writing values into XML (Maven pom.xml)
- **Path traversal:** Always validate resolved paths stay within project root before filesystem operations
- **Per-module locking:** `moduleActionLocks` on ServerState prevents concurrent package operations on the same module

### Phase Tracking

When a phase or sub-phase is completed, update **both**:
1. The checklist in this file (under "Current Phase")
2. The corresponding entry in [docs/implementation_roadmap.md](../docs/implementation_roadmap.md)

---

## Development Commands

```bash
pnpm install    # Install all dependencies
pnpm dev        # Run all packages in dev mode
pnpm build      # Build all packages
pnpm test       # Run tests
```

---

## Testing Strategy

| Package | Unit Tests | Integration Tests | E2E Tests |
|---------|-----------|-------------------|-----------|
| `backend` | Adapters, graph, query engine, cross-lang, executors, validators | WS protocol, registry integration | - |
| `shared` | Type guards, utility functions | - | - |
| `ui` | Component rendering, store logic, filter interactions | WebSocket connection handling | Playwright: scan → overview → explore → detail flow |

For testing methodology (TDD workflow, coverage requirements), see `.claude/rules/testing.md`.

---

## References

- **Architecture & component design:** [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
- **Implementation roadmap:** [docs/implementation_roadmap.md](../docs/implementation_roadmap.md)
- **Data models:** [docs/schemas/project.md](../docs/schemas/project.md)
- **Adapters:** [docs/schemas/adapters.md](../docs/schemas/adapters.md)
- **Views:** [docs/schemas/views.md](../docs/schemas/views.md)
- **Design decisions:** [docs/adr/](../docs/adr/) (001-Babel, 002-Zustand, 003-tree-sitter, 004-Lazy Pipeline)
- **General rules:** `.claude/rules/` (coding-style, security, testing, hooks, patterns)
