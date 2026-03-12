# Action Schemas

> **Canonical source:** `packages/shared/src/types/actions.ts` (planned)
> **Last verified:** Pre-implementation (schema designed, not yet coded)

Types for agent actions, safety classification, git snapshots, and rollback.

## Safety Tiers

Every action is classified into one of two tiers based on whether it can be safely auto-executed or should become part of a structured prompt:

### Safe (auto-execute)

These execute automatically with a git snapshot before each action:

- Adding dependencies (only if package has no postinstall scripts)
- Creating new files from templates (only if target path does not already contain a file)
- Updating lock files (only when following a safe dependency addition)
- Adding new keys to `.env.local`

### Complex (becomes prompt)

These are **not executed by the agent** — they become part of the structured prompt that users copy into their LLM coding tool:

- Modifying existing source files
- Changing existing config files (`next.config.js`, `tsconfig.json`, etc.)
- Installing packages with postinstall scripts
- Major version upgrades
- Deleting files
- Removing dependencies that have importers in the codebase
- Modifying `.gitignore` to exclude previously tracked files

**Default classification:** New actions default to **complex** until explicitly classified as safe.

## Action Types

```typescript
type Action =
  | InstallAction
  | CreateFileAction
  | ModifyFileAction
  | DeleteFileAction
  | ConfigAction
  | UninstallAction

interface BaseAction {
  /** Unique action ID */
  id: string
  /** Safety classification */
  safety: "safe" | "complex"
  /** Plain-language description */
  description: string
  /** Timestamp of creation */
  createdAt: string
}

interface InstallAction extends BaseAction {
  type: "install"
  /** Package name */
  packageName: string
  /** Version to install */
  version: string
  /** Whether to install as devDependency */
  isDev: boolean
  /** Whether the package has postinstall scripts */
  hasPostinstall: boolean
}

interface CreateFileAction extends BaseAction {
  type: "create_file"
  /** Relative path from project root */
  filePath: string
  /** File content */
  content: string
  /** What this file does (shown to user) */
  purpose: string
}

interface ModifyFileAction extends BaseAction {
  type: "modify_file"
  /** Relative path from project root */
  filePath: string
  /** Unified diff of changes */
  diff: string
  /** What this modification does (shown to user) */
  purpose: string
}

interface DeleteFileAction extends BaseAction {
  type: "delete_file"
  /** Relative path from project root */
  filePath: string
  /** Why this file is being deleted */
  reason: string
}

interface ConfigAction extends BaseAction {
  type: "config"
  /** Config file being modified, e.g. ".env.local", "next.config.js" */
  configFile: string
  /** Keys being added or modified */
  changes: readonly ConfigChange[]
}

interface ConfigChange {
  key: string
  /** New value (null if removing) */
  value: string | null
  /** Whether this is a new key or modifying an existing one */
  isNew: boolean
}

interface UninstallAction extends BaseAction {
  type: "uninstall"
  /** Package name to remove */
  packageName: string
  /** Files that import this package (shown to user for complex classification) */
  importers: readonly string[]
}
```

### Which Actions Are Directly Executed

Only safe-classified actions are executed by the agent:

| Action Type | When Safe (auto-execute) | When Complex (becomes prompt) |
|-------------|------------------------|-----------------------------|
| `InstallAction` | No postinstall scripts | Has postinstall scripts, major version upgrade |
| `CreateFileAction` | Target path doesn't exist | Target path already has a file |
| `ConfigAction` | Adding new `.env` keys | Modifying existing config files |
| `ModifyFileAction` | Never | Always complex |
| `DeleteFileAction` | Never | Always complex |
| `UninstallAction` | Never | Always complex |

`ModifyFileAction` and `DeleteFileAction` appear in the prompt context (describing what the user's coding tool should do), not as directly executed actions.

## ActionResult

Returned after a safe action executes, sent via `action_complete` messages.

```typescript
interface ActionResult {
  /** ID of the action that was executed */
  actionId: string
  /** Whether the action succeeded */
  success: boolean
  /** What happened (shown to user) */
  message: string
  /** Git snapshot created before this action (for rollback) */
  snapshot: GitSnapshot | null
  /** Error details if action failed */
  error?: {
    message: string
    suggestion: string
  }
}
```

## GitSnapshot

Created before every mutation to the user's project.

```typescript
interface GitSnapshot {
  /** Unique snapshot ID */
  id: string
  /** Git commit SHA */
  commitSha: string
  /** What action triggered this snapshot */
  description: string
  /** When the snapshot was created */
  createdAt: string
  /** Whether this snapshot can be rolled back to */
  canRollback: boolean
}
```

## RollbackRequest

Sent by the UI to restore a previous state.

```typescript
interface RollbackRequest {
  /** Snapshot ID to roll back to */
  snapshotId: string
}
```

## Non-Git Projects

If the user's project is not a git repository, the agent must initialize git (with user confirmation) before proceeding. Git snapshots are non-negotiable — git is a hard requirement for safe operation.

---

## Related Links

- [Messages Schema](./messages.md) — `ActionResult` sent via `action_complete` messages
- [Integration Schema](./integration.md) — `IntegrationResult` references `PlannedAction`
- [Prompt Schema](./prompt.md) — Complex actions become part of the structured prompt
- [Agent Spec](../spec/agent.md#executor) — Execution pipeline and snapshot strategy
- [Prompt Pipeline Spec](../spec/prompt-pipeline.md#hybrid-execution-decision-tree) — Decision tree for safe vs complex
