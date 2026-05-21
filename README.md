# Deckgraph

Multi-language dependency exploration and audit tool for large codebases.

Deckgraph scans a monorepo, auto-detects modules across ecosystems (JS/TS, Python, Go, Rust, Java), builds a unified dependency graph with cross-language edges, and presents layered, filterable views through an interactive web interface.

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Scan a project
npx deckgraph --project /path/to/monorepo

# Custom port
npx deckgraph --project /path/to/monorepo --port 4000
```

Open your browser to `http://127.0.0.1:3333` to explore the dependency graph.

## CLI Reference

```
deckgraph [options]

Options:
  --project <path>     Path to the project root (required)
  --port <number>      WebSocket server port (default: 3333)
  --no-open            Skip opening browser on start
  --no-watch           Disable file watching
  --version            Print version
  -h, --help           Show help
```

### Examples

```bash
# Basic scan
npx deckgraph --project ~/my-monorepo

# Don't open browser (useful for CI/scripts)
npx deckgraph --project ~/my-monorepo --no-open

# Custom port with file watching disabled
npx deckgraph --project ~/my-monorepo --port 8080 --no-watch
```

## Configuration

Create a `.deckgraph.yaml` file in your project root:

```yaml
# Paths to ignore during scanning
ignore-paths:
  - "node_modules"
  - ".git"
  - "dist"
  - "build"

# Override concern tags for specific packages
concern-overrides:
  "express":
    - "web-framework"
    - "http"
```

### Polyrepo / Workspace Mode

For multi-root workspaces, add a `roots` field:

```yaml
roots:
  - services/api
  - services/web
  - shared/libs

hooks:
  on-scan-complete:
    - "echo 'Scan done'"
  on-outdated:
    - "slack-notify.sh"
```

## VS Code Extension

Deckgraph includes a VS Code extension that provides:

- **Module tree sidebar** — Browse modules grouped by ecosystem
- **Inline decorations** — See dependency versions directly in manifest files
- **CodeLens** — View resolved versions on import lines
- **Dashboard panel** — Full web UI embedded in VS Code

### Commands

| Command | Description |
|---------|-------------|
| `Deckgraph: Start` | Start the backend process |
| `Deckgraph: Scan` | Initiate a project scan |
| `Deckgraph: Show Dashboard` | Open the web dashboard |
| `Deckgraph: Open Module` | Navigate to a specific module |
| `Deckgraph: Refresh Tree` | Refresh the module tree sidebar |

## Supported Ecosystems

| Ecosystem | Manifest Files | Adapter |
|-----------|---------------|---------|
| JS/TS | `package.json` | `@babel/parser` + `@babel/traverse` |
| Python | `requirements.txt`, `Pipfile`, `pyproject.toml` | `web-tree-sitter` (WASM) |
| Go | `go.mod` | `web-tree-sitter` (WASM) |
| Rust | `Cargo.toml` | `web-tree-sitter` (WASM) |
| Java | `pom.xml` | XML parser |

## Development

```bash
# Install dependencies
pnpm install

# Run all packages in dev mode
pnpm dev

# Build all packages
pnpm build

# Run tests
pnpm test

# Run E2E tests
pnpm test:e2e
```

### Hosted Demo Mode

Deckgraph can run as a read-only hosted demo that imports curated public GitHub repositories.

```bash
pnpm build
DECKGRAPH_DEMO_REPOS='[
  {
    "id": "deckgraph-fixture",
    "label": "Deckgraph Polyglot Fixture",
    "url": "https://github.com/simenzzz/Deckgraph.git",
    "description": "A compact repository with npm, PyPI, Go, Cargo, and Maven modules."
  }
]' node packages/backend/dist/index.js --demo --host 0.0.0.0 --port 3333 --no-open --no-watch
```

In demo mode the UI shows repository choices instead of the local scan button. Package install, update, remove, and batch actions are disabled so public visitors can explore scan results without mutating cloned repositories.

### Project Structure

```
packages/
├── backend/     # Node.js server (adapters, graph, query engine, WS server, actions)
├── ui/          # Web frontend (React 19 + Vite + shadcn/ui)
├── shared/      # Shared types & Zod schemas
└── vscode/      # VS Code extension
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed component design.

## License

Private — All rights reserved.
