# MCP Server Specification

The MCP Server provides all the tools the agent uses to analyze codebases, search package registries, fetch documentation, and manage integration templates.

## Overview

- **Package:** `@vibekit/mcp-server`
- **Transport:** stdio (spawned as a child process by the agent)
- **SDK:** `@modelcontextprotocol/sdk`
- **Architecture:** Single process with 4 tool namespaces

## Tool Namespaces

| Namespace | Tools | Phase |
|-----------|-------|-------|
| **codebase** | `scan_project`, `detect_framework`, `find_integrations`, `get_dependency_graph`, `get_file_purpose` | Phase 1 |
| **registry** | `search_packages`, `get_package_info`, `check_compatibility`, `check_vulnerabilities`, `resolve_conflicts` | Phase 1 (search, info), Phase 3 (vuln) |
| **docs** | `fetch_docs`, `get_examples`, `search_guides` | Phase 3 |
| **templates** | `list_templates`, `get_template`, `apply_template` | Phase 2b |

See [MCP Tools API](../api/mcp-tools.md) for the complete reference with parameters, return types, and examples.

## Parser Architecture

The parser system uses the **Strategy Pattern** to support adding new languages without modifying existing code.

### Core Interfaces

```typescript
// packages/mcp-server/src/parsers/types.ts

interface ParsedImport {
  /** Import source, e.g. "stripe", "./utils", "@auth0/nextjs-auth0" */
  source: string
  /** Imported names, e.g. ["Stripe", "default"] */
  specifiers: string[]
  /** true if not a relative/alias import */
  isThirdParty: boolean
  /** Line number in source file */
  line: number
}

interface DetectedPattern {
  /** What kind of pattern was detected */
  type: "framework" | "integration" | "config"
  /** Identifier, e.g. "nextjs", "stripe", "prisma" */
  name: string
  /** Detection confidence (0-1) */
  confidence: number
  /** What matched, e.g. "import from 'next/app'" */
  evidence: string
}

interface FileStructure {
  exports: readonly {
    name: string
    type: "function" | "class" | "variable" | "type"
  }[]
  imports: readonly ParsedImport[]
}

interface LanguageParser {
  /** File extensions this parser handles (e.g. [".ts", ".tsx", ".js"]) */
  readonly supportedExtensions: readonly string[]

  /** Parse imports/dependencies from source code */
  parseImports(source: string, filePath: string): readonly ParsedImport[]

  /** Detect framework/integration patterns in source code */
  detectPatterns(source: string, filePath: string): readonly DetectedPattern[]

  /** Get the structural overview of a file */
  getFileStructure(source: string, filePath: string): FileStructure
}
```

### Parser Registry

```typescript
// packages/mcp-server/src/parsers/registry.ts

interface ParserRegistry {
  /** Register a parser for its supported extensions */
  register(parser: LanguageParser): void

  /** Get the parser for a given file path (by extension). Returns null if unsupported. */
  getParser(filePath: string): LanguageParser | null

  /** List all currently supported file extensions */
  getSupportedExtensions(): readonly string[]
}
```

### Design Rules

1. **All codebase tools go through the registry** — Never call `@babel/parser` directly from tool code
2. **Adding a new language = implementing `LanguageParser` + registering it** — Zero changes to existing tools or parsers
3. **Parsers are stateless** — They receive source code and return data, no side effects
4. **Registry auto-discovers parsers** — No hardcoded list in tool code

### v1: BabelParser

The initial parser covers JavaScript and TypeScript:

- **Extensions:** `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`
- **Technology:** `@babel/parser` (pure JS, zero native dependencies)
- **Rationale:** See [ADR-001](../adr/001-babel-over-treesitter.md)

**Source:** `packages/mcp-server/src/parsers/babelParser.ts`

### Future Language Roadmap

| Phase | Language | Technology |
|-------|----------|-----------|
| Phase 2+ | Python | tree-sitter or pure-JS Python parser |
| Phase 3+ | Go, Rust, Java, Ruby | tree-sitter (accept native dep at this point) |
| Fallback | Any | `RegexParser` — basic import detection, low confidence, best-effort |

## Package Registries

### npm (Phase 1)

Primary registry for JavaScript/TypeScript packages:
- Search via npm registry API
- Package metadata, versions, download counts
- Dependency resolution

**Source:** `packages/mcp-server/src/registries/npm.ts`

### PyPI (Phase 2c)

Python package registry:
- Search via PyPI JSON API
- Package metadata, versions
- Added when Python parser support lands

**Source:** `packages/mcp-server/src/registries/pypi.ts`

## Template System

### Structure

Each template is a JSON file that defines:
- Required user configuration (API keys, etc.)
- Files to create or modify
- Dependencies to install
- Human-readable descriptions for every change

### Template ID Convention

Kebab-case: `{service}-{framework}`, e.g., `stripe-nextjs`, `clerk-express`, `supabase-nextjs`

### Curated Library Layout

```
templates/
├── payments/
│   └── stripe/          # nextjs.json, express.json, ...
├── auth/
│   ├── auth0/
│   ├── clerk/
│   └── firebase-auth/
├── database/
│   ├── supabase/
│   ├── prisma/
│   └── mongodb/
└── storage/
    ├── s3/
    └── cloudinary/
```

### Template Categories

`payments`, `auth`, `database`, `storage`, `email`, `analytics`, `ai-ml`, `maps`, `search`, `monitoring`, `messaging`

See [Integration Schema](../schemas/integration.md#integrationtemplate) for the full type definition.

## Caching

The MCP server caches:
- Package registry responses (TTL-based)
- Parsed file results (invalidated on file change)
- Template catalog (loaded once at startup)

**Source:** `packages/mcp-server/src/cache.ts`

---

## Related Links

- [MCP Tools API](../api/mcp-tools.md) — Full tool reference with parameters and examples
- [Agent Spec](./agent.md#mcp-client) — How the agent connects to the MCP server
- [Prompt Pipeline Spec](./prompt-pipeline.md) — How the analysis pipeline invokes MCP tools
- [Integration Schema](../schemas/integration.md) — Template and plan types
- [Project Schema](../schemas/project.md) — Parser-related types
- [ADR-001](../adr/001-babel-over-treesitter.md) — Why @babel/parser over tree-sitter
- [ADR-003](../adr/003-single-mcp-server.md) — Why a single MCP server
