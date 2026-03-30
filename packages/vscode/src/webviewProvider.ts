/**
 * Webview provider for the Deckgraph dashboard panel.
 *
 * Loads the UI from the backend's HTTP server (http://127.0.0.1:<port>).
 * Falls back to loading bundled UI assets via asWebviewUri if the server
 * is unreachable.
 */

import * as vscode from 'vscode';

export class DeckgraphWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'deckgraph.dashboard';

  private _view?: vscode.WebviewView;

  constructor(
    _context: vscode.ExtensionContext,
    private readonly getWsUrl: () => string,
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [],
    };

    this.loadDashboard();
  }

  /** Reload the dashboard content. */
  reload(): void {
    this.loadDashboard();
  }

  private loadDashboard(): void {
    if (!this._view) {
      return;
    }

    // Extract port from WS URL (ws://127.0.0.1:PORT)
    const wsUrl = this.getWsUrl();
    const portMatch = wsUrl.match(/:(\d+)/);
    const port = portMatch ? portMatch[1] : '3334';

    this._view.webview.html = this.getHtml(port);
  }

  private getHtml(port: string): string {
    const url = `http://127.0.0.1:${port}`;

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; frame-src http://127.0.0.1:${port}; style-src 'unsafe-inline';">
  <title>Deckgraph</title>
  <style>
    html, body, iframe {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100vh;
      border: none;
      overflow: hidden;
    }
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
    }
  </style>
</head>
<body>
  <iframe src="${url}" id="dashboard-frame">
    <div class="loading">Loading Deckgraph...</div>
  </iframe>
</body>
</html>`;
  }
}
