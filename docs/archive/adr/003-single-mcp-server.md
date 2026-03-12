# ADR-003: Single MCP Server over Multiple

**Status:** Accepted

## Context

The original design proposed four separate MCP servers: codebase-analyzer, package-registry, docs-context, and integration-templates. Each would be a separate process spawned by the agent.

During design refinement, the question arose: should these be separate processes or a single server with namespaced tools?

## Decision

Use a single MCP server (`@vibekit/mcp-server`) with four tool namespaces instead of four separate servers.

**Reasons:**
- **Simpler process management** — One subprocess to spawn, monitor, and restart instead of four
- **Shared caching** — Registry responses, parsed files, and template data share a single cache
- **Lower resource usage** — One Node.js process instead of four
- **Simpler deployment** — One package to build, test, and distribute
- **Tool namespacing** — MCP tool names already provide clear separation (`scan_project` vs `search_packages` vs `fetch_docs` vs `list_templates`)

## Consequences

- **Positive:** Fewer moving parts, easier debugging, lower memory footprint
- **Positive:** Shared cache improves performance and reduces redundant network calls
- **Negative:** A crash in one tool namespace takes down all tools (mitigated by agent auto-restart)
- **Negative:** Cannot independently scale or deploy tool namespaces (not needed for a local agent)
