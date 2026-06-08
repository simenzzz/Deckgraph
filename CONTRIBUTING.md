# Contributing to Deckgraph

Thank you for contributing to Deckgraph! This guide covers the development workflow, project structure, and conventions.

## Dev Setup

**Prerequisites:** Node.js >= 22, pnpm >= 9

```bash
# Clone and install
git clone <repo-url>
cd deckgraph
pnpm install

# Build all packages
pnpm build

# Verify everything works
pnpm test
```

## Project Structure

```
packages/
├── backend/     # Node.js server — adapters, graph, query engine, WS server, actions
├── ui/          # Web frontend — React 19 + Vite + shadcn/ui + Zustand
├── shared/      # Shared types, Zod schemas, utilities
└── vscode/      # VS Code extension — tree view, webview, decorations, CodeLens
```

**Package boundaries:**
- `shared` is the only package other packages may import for types
- UI must never import from backend directly
- All UI-to-backend communication goes through WebSocket

## Development Commands

```bash
pnpm dev          # Run all packages in dev/watch mode
pnpm build        # Build all packages
pnpm test         # Run all unit tests
pnpm test:e2e     # Run E2E tests (Playwright)
pnpm lint         # Lint all packages
pnpm format:write # Format with Prettier
pnpm clean        # Clean all build artifacts
```

## Testing

All packages use **Vitest** for unit testing. Coverage threshold: 80%.

### Running Tests

```bash
# All tests
pnpm test

# Single package
pnpm --filter @deckgraph/backend test
pnpm --filter @deckgraph/ui test

# Watch mode
pnpm --filter @deckgraph/backend test:watch
```

### Test Structure

| Package | Unit Tests | Integration Tests | E2E Tests |
|---------|-----------|-------------------|-----------|
| `backend` | Adapters, graph, query engine, cross-lang, executors, validators | WS protocol, registry integration | — |
| `shared` | Type guards, utility functions | — | — |
| `ui` | Component rendering, store logic, filter interactions | WebSocket connection handling | Playwright |
| `vscode` | BackendManager, WS client | — | — |

### TDD Workflow

1. Write a failing test (RED)
2. Write minimal code to pass (GREEN)
3. Refactor (IMPROVE)
4. Verify coverage >= 80%

## Adding a New Ecosystem

1. Create adapter directory: `packages/backend/src/adapters/<ecosystem>/`
2. Implement `ManifestParser` interface
3. Register in `AdapterRegistry` (`packages/backend/src/adapters/registry.ts`)
4. Add types to `@deckgraph/shared` (add to `Ecosystem` union)
5. Add Zod schema validation
6. Write adapter tests with fixtures
7. Add import analyzer if applicable

See [docs/schemas/adapters.md](docs/schemas/adapters.md) for the adapter interface specification.

## Commit Conventions

```
<type>: <description>

<optional body>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

### Examples

```
feat: add pipenv support to Python adapter
fix: resolve duplicate edges in cross-language detector
test: add fixtures for Cargo workspace detection
docs: update README with polyrepo configuration
```

## Architecture Overview

```
Web UI (React) ←→ WebSocket ←→ Backend (Node.js)
                                     │
                                     ├── Adapters (per ecosystem)
                                     ├── Unified Dependency Graph
                                     ├── Query Engine (filter, search, sort)
                                     ├── Cross-Language Edge Detector
                                     └── Package Manager (install, update, remove)
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full architecture document.
See [docs/future_work.md](docs/future_work.md) for proposed future work.

## Key Conventions

- **Immutability**: Never mutate objects — always create new copies with spread operators
- **Error handling**: Use `pino` for logging, never log secrets, surface user-friendly messages
- **Validation**: All external data is Zod-validated (registry APIs, WS messages, manifest content)
- **Subprocess safety**: Always use `execa` without shell, array args, 60s timeout
- **File organization**: Many small files (200-400 lines), organize by feature/domain
