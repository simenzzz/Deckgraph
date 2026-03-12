# Vibekit Documentation

Documentation for Vibekit — the prompt generation co-pilot for vibe coders.

## Quick Links

| Document | Description |
|----------|-------------|
| [Architecture](./ARCHITECTURE.md) | System diagrams, tech stack, project structure, security model |
| **Specifications** | |
| [Agent](./spec/agent.md) | Analysis pipeline, prompt composer, executor (safe actions), WebSocket protocol |
| [Prompt Pipeline](./spec/prompt-pipeline.md) | Deterministic analysis, LLM composition, Zod validation, hybrid execution |
| [MCP Server](./spec/mcp-server.md) | Tools, parser architecture, registries, templates |
| [UI](./spec/ui.md) | Screens, prompt preview/copy, stores, design principles, hooks |
| **API References** | |
| [WebSocket API](./api/websocket.md) | Every message type with shapes and JSON examples |
| [MCP Tools](./api/mcp-tools.md) | Every tool: params, returns, usage examples |
| [CLI](./api/cli.md) | Flags, config file, LLM provider configuration |
| **Data Schemas** | |
| [Messages](./schemas/messages.md) | ClientMessage / ServerMessage including `PromptReadyMessage` |
| [Prompt](./schemas/prompt.md) | StructuredPrompt, ContextBundle, PromptSection, Zod validation |
| [Project](./schemas/project.md) | ProjectState, FrameworkInfo, DependencyInfo |
| [Integration](./schemas/integration.md) | Templates, categories, IntegrationResult |
| [Actions](./schemas/actions.md) | Safety tiers (safe/complex), snapshots, rollback |
| **Decision Records** | |
| [ADR Index](./adr/README.md) | Architecture Decision Records |

## Relationship to Other Files

| File | Purpose |
|------|---------|
| `.claude/CLAUDE.md` | Claude session context — concise project overview, conventions, and phase tracking. Links here for details. |
| `.claude/rules/` | Coding style, security, testing, and hook rules that apply across all projects. |
| `docs/` (this folder) | Canonical project documentation — specs, API references, schemas, and decision records. |

## Documentation Conventions

- **Diagrams** use [Mermaid](https://mermaid.js.org/) syntax for GitHub rendering
- **Type definitions** use TypeScript code blocks
- **Cross-references** use relative links (e.g., `[Pipeline](./spec/prompt-pipeline.md)`)
- **Canonical source annotations** appear at the top of schema docs, naming the TypeScript source file
- **"Last verified" annotations** appear at the top of schema docs as a staleness signal
- **Related links** appear at the bottom of each document
