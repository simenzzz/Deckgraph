# Deckgraph — VS Code Extension

Multi-language dependency exploration directly in VS Code.

## Features

- **Module Tree** — Sidebar panel showing modules grouped by ecosystem
- **Dashboard** — Embedded web UI for the full Deckgraph experience
- **Inline Decorations** — Dependency version info shown in manifest files
- **CodeLens** — Resolved version annotations on import lines

## Getting Started

1. Open a workspace folder
2. Run **Deckgraph: Start** from the command palette (`Ctrl+Shift+P`)
3. The backend starts automatically and the tree view populates after scanning

## Commands

| Command | Keybinding | Description |
|---------|-----------|-------------|
| `Deckgraph: Start` | — | Start the backend process |
| `Deckgraph: Scan` | — | Initiate a project scan |
| `Deckgraph: Show Dashboard` | — | Open the web dashboard panel |
| `Deckgraph: Open Module` | — | Navigate to a specific module |
| `Deckgraph: Refresh Tree` | — | Refresh the module tree sidebar |

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `deckgraph.port` | `3334` | Port for the Deckgraph backend |

## Requirements

- Node.js >= 22
- VS Code >= 1.85.0

## How It Works

The extension spawns the Deckgraph backend as a child process and communicates over WebSocket. The backend scans your project, builds a dependency graph, and serves the web UI on a local port.

- On startup, the extension spawns the backend and waits for a readiness signal
- The tree view and dashboard connect via WebSocket to display live data
- If the backend crashes, it restarts with exponential backoff (max 3 retries)
