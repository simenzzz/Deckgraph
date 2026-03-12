# ADR-004: Prompt Generation Over Autonomous Agent

**Status:** Accepted

## Context

The original Vibekit architecture used Claude API as an autonomous agent: multi-turn reasoning, tool-use loops, and direct code generation/execution. This design had several problems:

1. **Hard API key requirement** — Users needed an Anthropic API key before they could do anything, creating friction for a tool targeting vibe coders who want zero-config experiences
2. **Non-deterministic core loop** — The LLM decided which tools to call, in what order, and what code to generate. This made the system unpredictable and hard to debug
3. **High cost per interaction** — Multi-turn reasoning with tool calls consumed significant tokens, making the tool expensive to operate
4. **Trust boundary issues** — An autonomous agent modifying user code required significant trust. Users had to review and approve changes made by a system they couldn't fully predict
5. **Redundant with user's existing tools** — Vibe coders already have LLM coding tools (Cursor, Claude Code, Copilot). Vibekit was duplicating their capabilities instead of augmenting them

## Decision

Replace the autonomous agent architecture with a **prompt generation co-pilot**:

1. **Deterministic analysis pipeline** — The agent calls MCP tools in a fixed, algorithmic order (scan project, detect framework, search packages, check compatibility, fetch template). No LLM decides which tools to call.

2. **Lightweight LLM for prompt composition** — A single LLM call composes a structured prompt from the analysis results. The LLM is a writer, not a decision-maker. Its output is Zod-validated and never trusted as deterministic.

3. **Hybrid execution model** — Safe actions (npm install, .env updates, new files from templates) execute directly. Complex changes (modify existing files, architectural decisions) become structured prompts that users copy into their own LLM coding tools.

4. **Configurable LLM provider with local default** — Zero API keys needed out of the box. A bundled/local model (e.g., Ollama) handles prompt composition. Users can optionally configure cloud providers (Anthropic, OpenAI) for higher quality.

5. **Zod validation of all LLM output** — The `StructuredPrompt` schema is validated with Zod. On validation failure: retry with error context (max 2 retries), then fall back to template-only prompt.

## Consequences

### Easier

- **Zero-config startup** — No API keys required by default
- **Predictable behavior** — Deterministic pipeline produces consistent results
- **Lower cost** — Single LLM call instead of multi-turn reasoning
- **Composable with existing tools** — Works alongside Cursor, Claude Code, Copilot instead of replacing them
- **Simpler testing** — Deterministic pipeline is unit-testable; LLM output has schema validation
- **Safer** — Complex code changes go through the user's own coding tool, where they have full control

### Harder

- **Prompt quality depends on templates** — Without good templates and analysis, the generated prompts will be generic
- **Two-step UX for complex changes** — Users must copy prompts to another tool instead of one-click apply
- **LLM composition adds a failure mode** — Even with validation and fallback, the LLM can produce low-quality (but valid) prompts
- **Local model quality** — Small local models produce lower quality prompts than cloud models; users may need to configure a cloud provider for best results

### Supersedes

This ADR supersedes the implicit "Claude API as autonomous agent" design from the original architecture. No prior ADR documented that decision explicitly.
