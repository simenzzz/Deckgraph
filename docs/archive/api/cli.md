# CLI Reference

Command-line interface for the Vibekit agent.

## Quick Start

```bash
npx vibekit --project /path/to/your/project
```

The agent starts, prints an auth token and URL, and waits for the UI to connect. No API keys required — uses a local LLM by default.

## Installation

### Via npx (recommended)

```bash
npx vibekit --project /path/to/project
```

No global install needed. Always uses the latest version.

### Global install

```bash
npm install -g vibekit
vibekit start --project /path/to/project
```

## Commands

### `vibekit start`

Start the agent for a project. This is the default command (can be omitted).

```bash
vibekit start [options]
# or simply:
vibekit [options]
```

### Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--project <path>` | Current working directory | Path to the project directory to analyze |
| `--port <number>` | `9547` | WebSocket server port |
| `--llm-provider <name>` | `local` | LLM provider: `local`, `anthropic`, `openai` |
| `--llm-model <name>` | Provider default | Model override for the configured provider |

**Examples:**

```bash
# Start with defaults (cwd, port 9547, local LLM)
npx vibekit

# Specify project path
npx vibekit --project ~/my-nextjs-app

# Use a custom port
npx vibekit --port 8080

# Use a cloud LLM provider for higher quality prompts
npx vibekit --llm-provider anthropic

# Both project and LLM config
npx vibekit --project ~/my-app --llm-provider openai --llm-model gpt-4o
```

## Configuration File

For persistent overrides, create `vibekit.config.json` in the project root:

```json
{
  "port": 9547,
  "llm": {
    "provider": "local",
    "model": null,
    "apiKey": null
  }
}
```

**Fields:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `port` | `number` | `9547` | WebSocket server port |
| `llm.provider` | `string` | `"local"` | LLM provider (`local`, `anthropic`, `openai`) |
| `llm.model` | `string \| null` | `null` | Model override (provider-specific) |
| `llm.apiKey` | `string \| null` | `null` | API key for cloud providers (prefer env var) |

The configuration file is optional. CLI flags override config file values, and config file values override environment variables.

**Cloud provider example:**

```json
{
  "port": 9547,
  "llm": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-5-20250929",
    "apiKey": "${VIBEKIT_LLM_API_KEY}"
  }
}
```

## Output

On startup, the agent prints:

```
Vibekit agent started!
  Project: /home/user/my-app (Next.js 14.1.0)
  WebSocket: ws://localhost:9547
  LLM: local (default)
  Auth token: abc123def456

Open the Vibekit UI and enter your auth token to connect.
```

Log output uses `pino` with structured JSON. Default level is `info` in production, `debug` in dev.

## Environment Variables

These are for LLM provider configuration and service connections:

| Variable | Required | Description |
|----------|----------|-------------|
| `VIBEKIT_LLM_PROVIDER` | No | LLM provider override (default: `local`) |
| `VIBEKIT_LLM_API_KEY` | Only for cloud providers | API key for Anthropic or OpenAI |
| `VIBEKIT_LLM_MODEL` | No | Model override for the configured provider |

Service-specific keys (Stripe, Auth0, etc.) are managed through the integration wizard and stored in the project's `.env.local`, not as global environment variables.

**Configuration priority:** CLI flags > Environment variables > Config file > Defaults

---

## Related Links

- [Agent Spec](../spec/agent.md) — Full agent specification
- [Agent Spec: Startup Sequence](../spec/agent.md#startup-sequence) — What happens on start
- [Agent Spec: LLM Provider](../spec/agent.md#llm-provider) — Provider configuration details
- [Prompt Pipeline Spec](../spec/prompt-pipeline.md#llm-provider-configuration) — LLM provider options
