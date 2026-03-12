# Message Schemas

> **Canonical source:** `packages/shared/src/types/messages.ts`
> **Last verified:** Pre-implementation (schema designed, not yet coded)

WebSocket message types for communication between the UI and the Agent.

## Common Envelope

Every message includes these fields:

```typescript
interface MessageEnvelope {
  /** Message type discriminator */
  type: string
  /** Protocol version — always 1 for now */
  version: 1
  /** UUID v4 for request/response correlation */
  requestId: string
}
```

## Client Messages (UI -> Agent)

```typescript
type ClientMessage =
  | ScanProjectMessage
  | AddIntegrationMessage
  | RemoveIntegrationMessage
  | UpdateDependencyMessage
  | ApproveActionMessage
  | RollbackMessage
  | RefinePromptMessage
  | CopyPromptMessage
  | ChatMessage
  | SyncMessage
  | PingMessage

interface ScanProjectMessage extends MessageEnvelope {
  type: "scan_project"
}

interface AddIntegrationMessage extends MessageEnvelope {
  type: "add_integration"
  /** Service identifier, e.g. "stripe", "clerk" */
  service: string
  /** Optional user intent description, e.g. "Add Stripe with a checkout button" */
  intent?: string
  /** Optional configuration provided by the user */
  config?: Record<string, string>
}

interface RemoveIntegrationMessage extends MessageEnvelope {
  type: "remove_integration"
  service: string
}

interface UpdateDependencyMessage extends MessageEnvelope {
  type: "update_dependency"
  /** Package name */
  name: string
  /** Target version */
  version: string
}

interface ApproveActionMessage extends MessageEnvelope {
  type: "approve_action"
  /** ID of the action to approve */
  actionId: string
}

interface RollbackMessage extends MessageEnvelope {
  type: "rollback"
  /** Git snapshot ID to roll back to */
  snapshotId: string
}

interface RefinePromptMessage extends MessageEnvelope {
  type: "refine_prompt"
  /** ID of the prompt to refine */
  promptId: string
  /** Natural-language feedback on what to change */
  feedback: string
}

interface CopyPromptMessage extends MessageEnvelope {
  type: "copy_prompt"
  /** ID of the prompt that was copied */
  promptId: string
  /** Which coding tool the user copied to */
  target: "cursor" | "claude-code" | "copilot" | "chatgpt" | "raw"
}

interface ChatMessage extends MessageEnvelope {
  type: "chat"
  /** Natural-language user message */
  message: string
}

interface SyncMessage extends MessageEnvelope {
  type: "sync"
}

interface PingMessage extends MessageEnvelope {
  type: "ping"
}
```

## Server Messages (Agent -> UI)

```typescript
type ServerMessage =
  | ProjectStateMessage
  | AgentThinkingMessage
  | PromptReadyMessage
  | ActionCompleteMessage
  | ErrorMessage
  | ChatResponseMessage
  | PingMessage

interface ProjectStateMessage extends MessageEnvelope {
  type: "project_state"
  /** Full project state snapshot */
  data: ProjectState
}

interface AgentThinkingMessage extends MessageEnvelope {
  type: "agent_thinking"
  /** Human-readable status of pipeline progress */
  message: string
}

interface PromptReadyMessage extends MessageEnvelope {
  type: "prompt_ready"
  /** Structured prompt for the user to review and copy */
  prompt: StructuredPrompt
  /** Safe actions that were or will be executed directly */
  directActions: readonly PlannedAction[]
  /** Project files bundled for context */
  contextBundle: ContextBundle
}

interface ActionCompleteMessage extends MessageEnvelope {
  type: "action_complete"
  /** Result of the executed action */
  result: ActionResult
}

interface ErrorMessage extends MessageEnvelope {
  type: "error"
  /** Plain-language: what happened */
  message: string
  /** Plain-language: what to do about it */
  suggestion: string
}

interface ChatResponseMessage extends MessageEnvelope {
  type: "chat_response"
  /** Agent's response to a chat message */
  message: string
}
```

## Supporting Types

These types are referenced by messages but defined in their own schema files:

| Type | Schema File | Description |
|------|-------------|-------------|
| `ProjectState` | [project.md](./project.md) | Full project state snapshot |
| `StructuredPrompt` | [prompt.md](./prompt.md) | Composed prompt for the user's coding tool |
| `ContextBundle` | [prompt.md](./prompt.md) | Bundled project files for prompt context |
| `PlannedAction` | [integration.md](./integration.md) | Action from the integration result |
| `ActionResult` | [actions.md](./actions.md) | Result of an executed action |

## Validation

All messages should be validated at the WebSocket boundary using Zod schemas that mirror these TypeScript types. The Zod schemas live alongside the types in `packages/shared/src/types/messages.ts`.

---

## Related Links

- [WebSocket API](../api/websocket.md) — Full API reference with JSON examples
- [Agent Spec](../spec/agent.md#websocket-server--protocol) — Protocol requirements and lifecycle
- [Prompt Schema](./prompt.md) — StructuredPrompt and ContextBundle types
- [Project Schema](./project.md) | [Integration Schema](./integration.md) | [Actions Schema](./actions.md)
