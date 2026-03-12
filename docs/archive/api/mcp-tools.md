# MCP Tools API Reference

Complete reference for all MCP server tools. The agent invokes these tools via the MCP protocol as part of the deterministic analysis pipeline.

## Overview

Single MCP server (`@vibekit/mcp-server`) with 4 namespaces and ~16 tools, communicated over stdio.

## Codebase Tools

### `scan_project`

Full project scan — structure, framework, language, dependencies.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | `string` | Yes | Absolute path to project root |

**Returns:** `ProjectScanResult`

```typescript
interface ProjectScanResult {
  framework: FrameworkInfo
  dependencies: readonly DependencyInfo[]
  integrations: readonly string[]
  fileCount: number
  languages: readonly { language: string; percentage: number }[]
}
```

**Example invocation:**
```json
{ "tool": "scan_project", "arguments": { "path": "/home/user/my-app" } }
```

**Phase:** 1

### `detect_framework`

Identify the project's framework (Next.js, Express, Vite, etc.).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | `string` | Yes | Absolute path to project root |

**Returns:** `FrameworkInfo` (see [Project Schema](../schemas/project.md#frameworkinfo))

**Example invocation:**
```json
{ "tool": "detect_framework", "arguments": { "path": "/home/user/my-app" } }
```

**Example response:**
```json
{
  "name": "nextjs",
  "version": "14.1.0",
  "confidence": 0.98,
  "evidence": "next.config.js found, next in dependencies",
  "language": "typescript"
}
```

**Phase:** 1

### `find_integrations`

List all third-party integrations currently present in the project.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | `string` | Yes | Absolute path to project root |

**Returns:** `readonly DetectedIntegration[]`

```typescript
interface DetectedIntegration {
  service: string
  confidence: number
  evidence: string
  files: readonly string[]
}
```

**Phase:** 3

### `get_dependency_graph`

Build the import/dependency graph for the project.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | `string` | Yes | Absolute path to project root |
| `depth` | `number` | No | Maximum depth to traverse (default: 3) |

**Returns:** `DependencyGraph`

```typescript
interface DependencyGraph {
  nodes: readonly GraphNode[]
  edges: readonly GraphEdge[]
}

interface GraphNode {
  id: string
  filePath: string
  type: "source" | "dependency" | "config"
}

interface GraphEdge {
  from: string
  to: string
  type: "import" | "require" | "config"
}
```

**Phase:** 1

### `get_file_purpose`

Explain what a file does in plain language.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filePath` | `string` | Yes | Absolute path to the file |

**Returns:** `{ purpose: string; exports: readonly string[]; imports: readonly string[] }`

**Phase:** 3

**Note:** This tool uses the configured lightweight LLM to generate the plain-language description, so it requires an active LLM connection.

## Registry Tools

### `search_packages`

Search across package registries.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | `string` | Yes | Search query |
| `ecosystem` | `"npm" \| "pypi"` | Yes | Which registry to search |
| `limit` | `number` | No | Max results (default: 10) |

**Returns:** `readonly PackageSearchResult[]`

```typescript
interface PackageSearchResult {
  name: string
  description: string
  version: string
  downloads: number
  score: number
}
```

**Phase:** 1 (npm), 2c (pypi)

### `get_package_info`

Get detailed metadata for a specific package.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | Yes | Package name |
| `ecosystem` | `"npm" \| "pypi"` | Yes | Which registry |

**Returns:** `PackageInfo`

```typescript
interface PackageInfo {
  name: string
  description: string
  version: string
  versions: readonly string[]
  license: string
  homepage: string | null
  repository: string | null
  dependencies: Record<string, string>
  weeklyDownloads: number
  hasPostinstall: boolean
}
```

**Phase:** 1

### `check_compatibility`

Check if a package is compatible with the project's current dependencies.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `package` | `string` | Yes | Package name |
| `version` | `string` | Yes | Target version |
| `projectDeps` | `Record<string, string>` | Yes | Current project dependencies |

**Returns:** `CompatibilityResult`

```typescript
interface CompatibilityResult {
  compatible: boolean
  conflicts: readonly DependencyConflict[]
  warnings: readonly string[]
}

interface DependencyConflict {
  package: string
  required: string
  installed: string
  resolution: string
}
```

**Phase:** 1

### `check_vulnerabilities`

Check packages for known security vulnerabilities (CVEs).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `packages` | `readonly string[]` | Yes | Package names to check |

**Returns:** `readonly VulnerabilityReport[]`

```typescript
interface VulnerabilityReport {
  package: string
  vulnerabilities: readonly {
    severity: "low" | "moderate" | "high" | "critical"
    description: string
    url: string
    fixedIn: string | null
  }[]
}
```

**Phase:** 3

### `resolve_conflicts`

Attempt to resolve dependency conflicts.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `conflicts` | `readonly DependencyConflict[]` | Yes | Conflicts to resolve |

**Returns:** `readonly ConflictResolution[]`

```typescript
interface ConflictResolution {
  package: string
  action: "upgrade" | "downgrade" | "replace" | "remove"
  targetVersion: string
  explanation: string
}
```

**Phase:** 3

## Documentation Tools

### `fetch_docs`

Fetch setup and usage documentation for a service.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `service` | `string` | Yes | Service name (e.g., "stripe") |
| `topic` | `string` | Yes | Topic (e.g., "setup", "webhooks") |

**Returns:** `{ content: string; url: string }`

**Phase:** 3

### `get_examples`

Get code examples for a service + framework combination.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `service` | `string` | Yes | Service name |
| `framework` | `string` | Yes | Framework name |

**Returns:** `readonly CodeExample[]`

```typescript
interface CodeExample {
  title: string
  description: string
  code: string
  language: string
}
```

**Phase:** 3

### `search_guides`

Search integration guides across documentation sources.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | `string` | Yes | Search query |

**Returns:** `readonly GuideResult[]`

```typescript
interface GuideResult {
  title: string
  url: string
  snippet: string
  relevance: number
}
```

**Phase:** 3

## Template Tools

### `list_templates`

Browse available integration templates.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `category` | `string` | No | Filter by category |
| `framework` | `string` | No | Filter by framework |

**Returns:** `readonly TemplateSummary[]`

```typescript
interface TemplateSummary {
  id: string
  service: string
  framework: string
  description: string
  version: string
}
```

**Phase:** 2b

### `get_template`

Get a specific template with all files, configs, and dependencies.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `service` | `string` | Yes | Service name |
| `framework` | `string` | Yes | Framework name |

**Returns:** `IntegrationTemplate` (see [Integration Schema](../schemas/integration.md#integrationtemplate))

**Phase:** 2b

### `apply_template`

Apply a template to the project (returns planned file operations, does not execute).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `templateId` | `string` | Yes | Template ID (e.g., "stripe-nextjs") |
| `config` | `Record<string, string>` | Yes | User-provided configuration values |

**Returns:** `readonly PlannedAction[]` (see [Integration Schema](../schemas/integration.md#integrationplan))

**Phase:** 2b

## Implementation Notes

| Phase | Tools Shipped |
|-------|--------------|
| Phase 1 | `scan_project`, `detect_framework`, `get_dependency_graph`, `search_packages`, `get_package_info`, `check_compatibility` |
| Phase 2b | `list_templates`, `get_template`, `apply_template` |
| Phase 2c | PyPI support for `search_packages`, `get_package_info` |
| Phase 3 | `find_integrations`, `get_file_purpose`, `check_vulnerabilities`, `resolve_conflicts`, `fetch_docs`, `get_examples`, `search_guides` |

---

## Related Links

- [MCP Server Spec](../spec/mcp-server.md) — Architecture, parser system, caching
- [Agent Spec](../spec/agent.md#analysis-pipeline) — How the agent invokes tools
- [Prompt Pipeline Spec](../spec/prompt-pipeline.md) — Full pipeline specification
- [Integration Schema](../schemas/integration.md) — Template and plan types
- [Project Schema](../schemas/project.md) — Project state types
