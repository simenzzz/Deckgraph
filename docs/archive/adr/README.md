# Architecture Decision Records

ADRs capture significant architectural decisions with their context, rationale, and consequences. They are immutable once accepted — superseded decisions get a new ADR referencing the old one.

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [001](./001-babel-over-treesitter.md) | @babel/parser over tree-sitter for v1 | Accepted |
| [002](./002-zustand-over-redux.md) | Zustand over Redux for UI state | Accepted |
| [003](./003-single-mcp-server.md) | Single MCP server over multiple | Accepted |
| [004](./004-prompt-generation-over-autonomous-agent.md) | Prompt generation over autonomous agent | Accepted |

## Template for New ADRs

```markdown
# ADR-NNN: Title

**Status:** Proposed | Accepted | Deprecated | Superseded by [ADR-NNN]

## Context

What is the issue that we're seeing that is motivating this decision or change?

## Decision

What is the change that we're proposing and/or doing?

## Consequences

What becomes easier or more difficult to do because of this change?
```

**Naming convention:** `NNN-kebab-case-title.md` (e.g., `004-add-python-parser.md`)
