# Project Schemas

> **Canonical source:** `packages/shared/src/types/project.ts`
> **Last verified:** Pre-implementation (schema designed, not yet coded)

Types representing the state of the user's project as understood by the agent.

## ProjectState

Top-level state object pushed from agent to UI via `project_state` messages.

```typescript
interface ProjectState {
  /** Absolute path to the project root */
  path: string
  /** Detected project name (from package.json or directory name) */
  name: string
  /** Framework detection result */
  framework: FrameworkInfo
  /** Project health assessment */
  health: ProjectHealth
  /** All detected dependencies */
  dependencies: readonly DependencyInfo[]
  /** Active integrations detected in the codebase */
  integrations: readonly string[]
  /** Whether the project is a git repository */
  isGitRepo: boolean
  /** Timestamp of last scan */
  lastScannedAt: string
}
```

## FrameworkInfo

```typescript
interface FrameworkInfo {
  /** Framework identifier, e.g. "nextjs", "express", "vite-react" */
  name: string
  /** Detected version (from package.json) */
  version: string | null
  /** Detection confidence (0-1) */
  confidence: number
  /** What evidence led to this detection */
  evidence: string
  /** Primary language: "typescript" | "javascript" */
  language: "typescript" | "javascript"
}
```

## DependencyInfo

```typescript
interface DependencyInfo {
  /** Package name, e.g. "stripe", "@auth0/nextjs-auth0" */
  name: string
  /** Installed version */
  version: string
  /** Whether this is a devDependency */
  isDev: boolean
  /** Latest available version from registry */
  latestVersion: string | null
  /** Whether an update is available */
  hasUpdate: boolean
  /** Known vulnerabilities (empty if none) */
  vulnerabilities: readonly VulnerabilityInfo[]
}

interface VulnerabilityInfo {
  /** Severity: "low" | "moderate" | "high" | "critical" */
  severity: "low" | "moderate" | "high" | "critical"
  /** Human-readable description */
  description: string
  /** Advisory URL */
  url: string
}
```

## ProjectHealth

```typescript
interface ProjectHealth {
  /** Overall status */
  status: "healthy" | "warning" | "error"
  /** Number of total dependencies */
  dependencyCount: number
  /** Number of dependencies with available updates */
  outdatedCount: number
  /** Number of known vulnerabilities across all deps */
  vulnerabilityCount: number
  /** Number of active integrations */
  integrationCount: number
  /** Human-readable summary */
  summary: string
}
```

## Parser Types (Reference)

The parser system defines its own types in `packages/mcp-server/src/parsers/types.ts`. These are internal to the MCP server and not part of the shared schema, but are documented here for completeness:

- `ParsedImport` — Represents a single import statement
- `DetectedPattern` — A framework/integration pattern detected in source code
- `FileStructure` — Exports and imports of a file

See [MCP Server Spec](../spec/mcp-server.md#parser-architecture) for full type definitions.

---

## Related Links

- [Messages Schema](./messages.md) — `ProjectState` is sent via `project_state` messages
- [Integration Schema](./integration.md) — Integration types referenced by project state
- [MCP Server Spec](../spec/mcp-server.md) — Parser types and codebase analysis
