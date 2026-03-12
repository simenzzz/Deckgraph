# UI Specification

The Web UI is the user-facing layer of Vibekit — a polished, approachable interface designed for vibe coders who prefer visual tools over terminals.

## Overview

- **Package:** `@vibekit/ui`
- **Stack:** React 19 + Vite + shadcn/ui
- **State:** Zustand (server-pushed, not independent)
- **Styling:** Tailwind CSS v4
- **Hosting:** Vercel
- **Communication:** WebSocket to Local Agent

## Design Principles

1. **No terminal-like interfaces** — Everything is visual and clickable
2. **Icons and colors over text** — Where possible, use visual cues instead of words
3. **Plain-English explanations** — Every action has a human-readable description
4. **Errors show "what happened" + "what to do"** — Never stack traces or error codes
5. **Undo is always available** — Git snapshots make every action reversible
6. **Prompt-first for complex changes** — Users review and copy prompts to their own tools

## Screens

### Dashboard

The home screen showing project health at a glance.

- **ProjectHealth** card — Dependency count, issue count, active services
- **ActiveIntegrations** — Cards for each installed service with health status
- **QuickActions** — Buttons for common operations (Add Integration, Update All, Check Health, Ask Agent)

```
+----------------------------------------------------------+
|  My Project -- Next.js App             [Agent: Online]    |
+----------+-----------------------------------------------+
|          |                                                |
| Sidebar  |  Project Health                                |
|          |  +----------+ +----------+ +----------+        |
| Dashboard|  | 12 deps  | | 0 issues | | 3 active |       |
| Market   |  | all good | |          | | services |       |
| Deps     |  +----------+ +----------+ +----------+       |
| Timeline |                                                |
| Chat     |  Active Integrations                           |
|          |  +----------+ +----------+ +----------+        |
|          |  | Stripe   | | Supabase | | Clerk    |       |
|          |  | Payments | | Database | | Auth     |       |
|          |  | Healthy  | | Healthy  | | Update   |       |
|          |  +----------+ +----------+ +----------+       |
|          |                                                |
|          |  Quick Actions                                 |
|          |  [ + Add Integration ] [ Update All ]          |
|          |  [ Check Health   ] [ Ask Agent  ]             |
|          |                                                |
+----------+------------------------------------------------+
```

### Marketplace

Browse and search available integrations.

- **CategoryFilter** sidebar — Payments, Auth, Database, Storage, etc.
- **SearchBar** — Full-text search across integrations
- **IntegrationCard** — Service logo, name, description, "Add" button

```
+----------------------------------------------------------+
|  Add an Integration              Search...                |
+----------+-----------------------------------------------+
|          |                                                |
| All      |  +-----------------+ +-----------------+      |
| Payments |  | [Stripe logo]   | | [Firebase logo] |      |
| Auth     |  | Stripe          | | Firebase        |      |
| Database |  | Accept payments | | Full backend    |      |
| Storage  |  | online          | | as a service    |      |
| Email    |  |                 | |                 |      |
| Analytics|  | [ + Add ]       | | [ + Add ]       |      |
| AI/ML    |  +-----------------+ +-----------------+      |
| Maps     |  +-----------------+ +-----------------+      |
| Search   |  | [Supabase logo] | | [Clerk logo]    |      |
|          |  | Supabase        | | Clerk           |      |
|          |  | Database +      | | User login &    |      |
|          |  | auth + storage  | | management      |      |
|          |  | [ + Add ]       | | [ + Add ]       |      |
|          |  +-----------------+ +-----------------+      |
+----------+------------------------------------------------+
```

### Integration Wizard

Three-step flow for adding an integration:

1. **Configure** — API key inputs with help text pointing to where to find values
2. **Review** — Split display: safe actions (auto-applied) and complex changes (prompt preview)
3. **Prompt & Copy** — Formatted prompt preview with copy-to buttons for different coding tools

**Step 1 — Configure:**

```
Step 1 of 3: Configure    *---o---o

+----------------------------------------------------------+
|  Adding Stripe -- Accept payments in your app             |
|                                                           |
|  What Stripe does:                                        |
|  Stripe lets your users pay with credit cards, Apple      |
|  Pay, and more. You'll need a free Stripe account.        |
|                                                           |
|  +-- Configuration ----------------------------------+   |
|  |                                                    |   |
|  |  Stripe Secret Key     [sk_test_...         ]      |   |
|  |  (Find this at dashboard.stripe.com/apikeys)       |   |
|  |                                                    |   |
|  |  Stripe Public Key     [pk_test_...         ]      |   |
|  |  (Same page, the "publishable" key)                |   |
|  |                                                    |   |
|  |  Webhook Secret        [whsec_...           ]      |   |
|  |  (Optional -- needed for subscriptions)            |   |
|  |                                                    |   |
|  +----------------------------------------------------+   |
|                                                           |
|                              [ Cancel ]  [ Next -> ]      |
+-----------------------------------------------------------+
```

**Step 2 — Review:**

```
Step 2 of 3: Review    o---*---o

+----------------------------------------------------------+
|  Here's what will happen:                                 |
|                                                           |
|  Applied automatically (safe):                            |
|    * Install stripe package (v14.5.0)                     |
|    * Create lib/stripe.ts (payment helper)                |
|    * Add API keys to .env.local                           |
|                                                           |
|  Included in prompt (complex):                            |
|    * Add webhook route at app/api/webhooks/stripe/        |
|      [Preview in prompt]                                  |
|    * Update middleware.ts to exclude webhook route         |
|      [Preview in prompt]                                  |
|                                                           |
|  The agent will create a git snapshot. You can always     |
|     undo safe actions from the Timeline.                  |
|                                                           |
|                   [ <- Back ]  [ Apply Safe & Generate ]   |
+-----------------------------------------------------------+
```

**Step 3 — Prompt & Copy:**

```
Step 3 of 3: Prompt & Copy    o---o---*

+----------------------------------------------------------+
|  Safe actions applied:                                    |
|    * Installed stripe v14.5.0                             |
|    * Created lib/stripe.ts                                |
|    * Added API keys to .env.local                         |
|                                                           |
|  +-- Prompt Preview ----------------------------------+   |
|  | ## Context                                         |   |
|  | You're working on a Next.js 14 app with TypeScript |   |
|  | and Clerk auth. Stripe v14.5.0 is now installed.   |   |
|  |                                                    |   |
|  | ## Instructions                                    |   |
|  | 1. Create a webhook route at                       |   |
|  |    app/api/webhooks/stripe/route.ts that...        |   |
|  | 2. Update middleware.ts to exclude the              |   |
|  |    webhook route from Clerk auth...                |   |
|  |                                                    |   |
|  | ## Relevant Files                                  |   |
|  | middleware.ts:                                      |   |
|  | ```typescript                                      |   |
|  | import { authMiddleware } from '@clerk/nextjs'...  |   |
|  | ```                                                |   |
|  +----------------------------------------------------+   |
|                                                           |
|  Copy to:                                                 |
|  [ Cursor ] [ Claude Code ] [ Copilot ] [ Copy Raw ]     |
|                                                           |
|  Next steps:                                              |
|    1. Paste the prompt in your coding tool                |
|    2. Review and apply the changes it suggests            |
|    3. Test with Stripe's test card: 4242 4242 4242 4242   |
|                                                           |
|                                       [ Go to Dashboard ] |
+-----------------------------------------------------------+
```

### Dependency Manager

- **DependencyList** — All project dependencies with status indicators
- **DependencyCard** — Version, update availability, vulnerability status
- **ConflictResolver** — Plain-language conflict descriptions with suggested resolutions

### Activity Timeline

- **ActivityFeed** — Chronological history of all agent actions
- **UndoButton** — One-click rollback to any previous git snapshot

### Prompt Chat Sidebar

- **PromptChat** — Natural-language conversation for refining prompts
- **MessageBubble** — Agent responses with inline actions and code blocks

The chat sidebar is primarily for **prompt refinement** — users can provide feedback on a generated prompt and request changes (e.g., "Include error handling for the webhook", "Use the app router pattern instead").

## State Management

### Zustand Stores

| Store | Data | Source |
|-------|------|--------|
| `projectStore` | Project metadata, framework info, health status | Agent push via `project_state` |
| `agentStore` | Connection status, pipeline progress, pending approvals | Agent push via `agent_thinking`, `prompt_ready` |
| `integrationStore` | Active integrations, marketplace catalog, wizard state | Agent push via `project_state`, `action_complete` |
| `promptStore` | Current prompt, refinement history, copy targets | Agent push via `prompt_ready` |

**Key principles:**
- Agent is the source of truth — stores are caches of server-pushed state
- No optimistic updates — UI waits for server confirmation
- On reconnect, UI sends `{ type: "sync" }` to receive full state

See [ADR-002](../adr/002-zustand-over-redux.md) for rationale.

## Component Organization

```
components/
├── layout/             # Sidebar, Header, Shell
├── dashboard/          # ProjectHealth, ActiveIntegrations, QuickActions
├── marketplace/        # IntegrationCard, CategoryFilter, SearchBar
├── wizard/             # StepIndicator, ConfigForm, ReviewPane
├── prompt/             # PromptPreview, CopyTargetSelector, PromptRefinement
├── deps/              # DependencyList, DependencyCard, ConflictResolver
├── timeline/           # ActivityFeed, UndoButton
└── chat/              # PromptChat, MessageBubble
```

Component files use PascalCase: `ProjectHealth.tsx`, `PromptPreview.tsx`.

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `PromptPreview` | `prompt/` | Renders the structured prompt with syntax highlighting and section headings |
| `CopyTargetSelector` | `prompt/` | Buttons for copying to Cursor, Claude Code, Copilot, ChatGPT, or raw clipboard |
| `PromptRefinement` | `prompt/` | Feedback input for requesting changes to a generated prompt |

## Hooks

| Hook | Purpose |
|------|---------|
| `useAgent` | WebSocket connection management, message sending |
| `useProject` | Access project state from `projectStore` |
| `usePromptReview` | Access current prompt, copy-to-target, refinement state from `promptStore` |

**Source:** `packages/ui/src/hooks/`

## WebSocket Client

The UI connects to the agent via a WebSocket client wrapper:

- Auto-reconnect with exponential backoff
- Sends `sync` on reconnect to get full state
- Monitors heartbeat (60s timeout triggers reconnect)
- Queues messages while disconnected

**Source:** `packages/ui/src/lib/ws-client.ts`

## Premium Feature Gating

Premium features are gated with feature flags:

- **Visual dependency graph** — Premium-only component, gated at the route level
- Implementation should use clean boundaries (feature flags, not deeply interleaved logic)
- Flag values are determined by license check (future implementation)

---

## Related Links

- [Architecture](../ARCHITECTURE.md#state-architecture) — State flow diagram
- [Prompt Pipeline Spec](./prompt-pipeline.md) — How prompts are generated
- [Prompt Schema](../schemas/prompt.md) — StructuredPrompt and ContextBundle types
- [WebSocket API](../api/websocket.md) — Message types and examples
- [Messages Schema](../schemas/messages.md) — TypeScript type definitions
- [Agent Spec](./agent.md#websocket-server--protocol) — Server-side protocol details
- [ADR-002](../adr/002-zustand-over-redux.md) — Why Zustand over Redux
