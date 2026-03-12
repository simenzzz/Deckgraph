# WebSocket API Reference

Complete reference for the WebSocket protocol between the UI and the Agent.

## Connection

- **Endpoint:** `ws://localhost:9547` (default port, configurable via `--port`)
- **Auth:** First message after connect must include the one-time auth token
- **Protocol version:** All messages include `version: 1`

## Client Messages (UI -> Agent)

### `scan_project`

Request a full project scan.

```json
{
  "type": "scan_project",
  "version": 1,
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:** `project_state` with full scan results.

### `add_integration`

Start the integration flow for a service. Triggers the deterministic analysis pipeline.

```json
{
  "type": "add_integration",
  "version": 1,
  "requestId": "550e8400-e29b-41d4-a716-446655440001",
  "service": "stripe",
  "intent": "Add Stripe with a checkout button on the pricing page",
  "config": {
    "STRIPE_SECRET_KEY": "sk_test_...",
    "STRIPE_PUBLISHABLE_KEY": "pk_test_..."
  }
}
```

**Response sequence:** One or more `agent_thinking` messages (pipeline progress), then `action_complete` for each safe action executed, then `prompt_ready` with the structured prompt for complex changes.

### `remove_integration`

Remove an existing integration.

```json
{
  "type": "remove_integration",
  "version": 1,
  "requestId": "550e8400-e29b-41d4-a716-446655440002",
  "service": "stripe"
}
```

**Response sequence:** `agent_thinking`, then `prompt_ready` with removal prompt.

### `update_dependency`

Update a specific dependency to a new version.

```json
{
  "type": "update_dependency",
  "version": 1,
  "requestId": "550e8400-e29b-41d4-a716-446655440003",
  "name": "stripe",
  "version": "14.5.0"
}
```

**Response:** `action_complete` after update.

### `approve_action`

Approve a safe action for execution.

```json
{
  "type": "approve_action",
  "version": 1,
  "requestId": "550e8400-e29b-41d4-a716-446655440004",
  "actionId": "action-001"
}
```

**Response:** `action_complete` with the result.

### `rollback`

Roll back to a previous git snapshot.

```json
{
  "type": "rollback",
  "version": 1,
  "requestId": "550e8400-e29b-41d4-a716-446655440006",
  "snapshotId": "snapshot-abc123"
}
```

**Response:** `action_complete` confirming rollback, then `project_state` with updated state.

### `refine_prompt`

Request changes to a previously generated prompt.

```json
{
  "type": "refine_prompt",
  "version": 1,
  "requestId": "550e8400-e29b-41d4-a716-446655440010",
  "promptId": "prompt-001",
  "feedback": "Include error handling for the webhook endpoint"
}
```

**Response sequence:** `agent_thinking`, then `prompt_ready` with the refined prompt.

### `copy_prompt`

Log that the user copied a prompt to a coding tool (for analytics and UX tracking).

```json
{
  "type": "copy_prompt",
  "version": 1,
  "requestId": "550e8400-e29b-41d4-a716-446655440011",
  "promptId": "prompt-001",
  "target": "cursor"
}
```

**Response:** Acknowledgment only.

### `chat`

Send a natural-language message to the agent.

```json
{
  "type": "chat",
  "version": 1,
  "requestId": "550e8400-e29b-41d4-a716-446655440007",
  "message": "How do I set up webhooks for Stripe?"
}
```

**Response sequence:** `agent_thinking`, then `chat_response`.

### `sync`

Request full state (sent on reconnect).

```json
{
  "type": "sync",
  "version": 1,
  "requestId": "550e8400-e29b-41d4-a716-446655440008"
}
```

**Response:** `project_state` with full current state.

### `ping`

Heartbeat message.

```json
{
  "type": "ping",
  "version": 1,
  "requestId": "550e8400-e29b-41d4-a716-446655440009"
}
```

## Server Messages (Agent -> UI)

### `project_state`

Full project state snapshot. Sent on initial connect, after `sync`, and after state-changing operations.

```json
{
  "type": "project_state",
  "version": 1,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "data": {
    "path": "/home/user/my-app",
    "name": "my-app",
    "framework": {
      "name": "nextjs",
      "version": "14.1.0",
      "confidence": 0.98,
      "evidence": "next.config.js found, next in dependencies",
      "language": "typescript"
    },
    "health": {
      "status": "healthy",
      "dependencyCount": 12,
      "outdatedCount": 2,
      "vulnerabilityCount": 0,
      "integrationCount": 3,
      "summary": "12 dependencies, all good. 2 updates available."
    },
    "dependencies": [],
    "integrations": ["stripe", "clerk", "supabase"],
    "isGitRepo": true,
    "lastScannedAt": "2025-06-15T10:30:00Z"
  }
}
```

### `agent_thinking`

Real-time status of what the analysis pipeline is doing.

```json
{
  "type": "agent_thinking",
  "version": 1,
  "requestId": "550e8400-e29b-41d4-a716-446655440001",
  "message": "Scanning your project to understand the codebase..."
}
```

Typical pipeline progress messages:
- "Scanning your project..."
- "Searching for Stripe package..."
- "Checking compatibility with your dependencies..."
- "Loading integration template..."
- "Composing prompt..."

### `prompt_ready`

Structured prompt for the user to review and copy, along with safe actions that were or will be executed.

```json
{
  "type": "prompt_ready",
  "version": 1,
  "requestId": "550e8400-e29b-41d4-a716-446655440001",
  "prompt": {
    "id": "prompt-001",
    "userIntent": "Add Stripe with a checkout button",
    "service": "stripe",
    "framework": "nextjs",
    "content": "## Context\nYou're working on a Next.js 14 app with TypeScript...\n\n## Instructions\n1. Create a webhook route...",
    "sections": [
      {
        "type": "context",
        "title": "Project Context",
        "content": "You're working on a Next.js 14 app with TypeScript and Clerk auth."
      },
      {
        "type": "instructions",
        "title": "Integration Steps",
        "content": "1. Create a webhook route at app/api/webhooks/stripe/route.ts..."
      }
    ],
    "analysisSummary": {
      "framework": { "name": "nextjs", "version": "14.1.0" },
      "relevantDependencies": ["next", "@clerk/nextjs"],
      "templateId": "stripe-nextjs",
      "existingIntegrations": ["clerk"]
    },
    "createdAt": "2025-06-15T10:31:00Z"
  },
  "directActions": [
    {
      "id": "action-001",
      "type": "install",
      "description": "Install stripe package (v14.5.0)",
      "details": { "packageName": "stripe", "version": "14.5.0" },
      "safety": "safe"
    },
    {
      "id": "action-002",
      "type": "config",
      "description": "Add API keys to .env.local",
      "details": { "configFile": ".env.local" },
      "safety": "safe"
    }
  ],
  "contextBundle": {
    "files": [
      {
        "path": "src/middleware.ts",
        "content": "import { authMiddleware } from '@clerk/nextjs'...",
        "reason": "Will need modification to exclude webhook route",
        "truncated": false
      }
    ],
    "totalSize": 1250,
    "truncated": false
  }
}
```

### `action_complete`

Result of an executed safe action.

```json
{
  "type": "action_complete",
  "version": 1,
  "requestId": "550e8400-e29b-41d4-a716-446655440004",
  "result": {
    "actionId": "action-001",
    "success": true,
    "message": "Installed stripe v14.5.0",
    "snapshot": {
      "id": "snapshot-abc123",
      "commitSha": "a1b2c3d",
      "description": "Before: install stripe v14.5.0",
      "createdAt": "2025-06-15T10:32:00Z",
      "canRollback": true
    }
  }
}
```

### `error`

Error with a plain-language suggestion.

```json
{
  "type": "error",
  "version": 1,
  "requestId": "550e8400-e29b-41d4-a716-446655440001",
  "message": "Could not connect to npm registry",
  "suggestion": "Check your internet connection and try again"
}
```

### `chat_response`

Agent's response to a chat message.

```json
{
  "type": "chat_response",
  "version": 1,
  "requestId": "550e8400-e29b-41d4-a716-446655440007",
  "message": "To set up Stripe webhooks, you'll need to..."
}
```

### `ping`

Server heartbeat (sent every 30 seconds).

```json
{
  "type": "ping",
  "version": 1,
  "requestId": "server-ping-001"
}
```

## Streaming Patterns

During the deterministic analysis pipeline, the server sends `agent_thinking` messages for each step before the final result:

```
Client:  add_integration { service: "stripe", intent: "Add Stripe", requestId: "req-1" }
Server:  agent_thinking  { message: "Scanning project...", requestId: "req-1" }
Server:  agent_thinking  { message: "Searching for Stripe package...", requestId: "req-1" }
Server:  agent_thinking  { message: "Checking compatibility...", requestId: "req-1" }
Server:  agent_thinking  { message: "Loading template...", requestId: "req-1" }
Server:  agent_thinking  { message: "Composing prompt...", requestId: "req-1" }
Server:  action_complete { result: { actionId: "action-001", ... }, requestId: "req-1" }
Server:  action_complete { result: { actionId: "action-002", ... }, requestId: "req-1" }
Server:  prompt_ready    { prompt: {...}, directActions: [...], contextBundle: {...}, requestId: "req-1" }
```

All streaming messages reference the original `requestId` for correlation.

## Error Responses

Errors can occur at any point. They always include `message` (what happened) and `suggestion` (what to do):

| Scenario | Message | Suggestion |
|----------|---------|------------|
| Network failure | "Could not connect to npm registry" | "Check your internet connection and try again" |
| Package not found | "No package found matching 'strype'" | "Did you mean 'stripe'? Check the spelling and try again" |
| Auth failure | "Invalid authentication token" | "Restart the agent to get a new token" |
| Action failure | "Could not install stripe package" | "Check your internet connection and try again" |
| Prompt composition failure | "Could not compose integration prompt" | "Try again. If the problem persists, check your LLM provider configuration." |

---

## Related Links

- [Agent Spec](../spec/agent.md#websocket-server--protocol) — Protocol requirements and lifecycle
- [Prompt Pipeline Spec](../spec/prompt-pipeline.md) — How pipeline produces prompts
- [Messages Schema](../schemas/messages.md) — TypeScript type definitions
- [Prompt Schema](../schemas/prompt.md) — StructuredPrompt and ContextBundle types
- [Actions Schema](../schemas/actions.md) — Action and result types
- [Integration Schema](../schemas/integration.md) — IntegrationResult type
