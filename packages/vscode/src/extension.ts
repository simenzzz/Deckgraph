/**
 * Deckgraph VS Code extension entry point.
 *
 * Activates the backend process, registers tree data providers,
 * webview panel, decorations, CodeLens, and commands.
 */

import * as vscode from 'vscode';
import { BackendManager } from './backendManager';
import { createWsClient, type WsClient } from './backendWsClient';
import { ModuleTreeProvider } from './treeDataProvider';
import { DeckgraphWebviewProvider } from './webviewProvider';
import { DeckgraphCodeLensProvider } from './codeLens';
import { applyDecorations, getDecorationType } from './decorations';
import type {
  ServerMessage,
  ViewResult,
  ModuleView,
  ViewSummary,
  Ecosystem,
  DependencyScope,
} from '@deckgraph/shared';

// Extension state

let backendManager: BackendManager | undefined;
let wsClient: WsClient | undefined;
let treeProvider: ModuleTreeProvider | undefined;
let webviewProvider: DeckgraphWebviewProvider | undefined;
let codeLensProvider: DeckgraphCodeLensProvider | undefined;
let currentViewResult: ViewResult | null = null;

// Activation

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // --- Backend Manager ---
  backendManager = new BackendManager(context);
  context.subscriptions.push({ dispose: () => backendManager?.dispose() });

  // --- Tree Data Provider ---
  treeProvider = new ModuleTreeProvider();
  const treeView = vscode.window.createTreeView('deckgraph.moduleTree', {
    treeDataProvider: treeProvider,
  });
  context.subscriptions.push(treeView);

  // --- Webview Provider ---
  webviewProvider = new DeckgraphWebviewProvider(
    context,
    () => backendManager?.getWsUrl() ?? 'ws://127.0.0.1:3334',
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      DeckgraphWebviewProvider.viewType,
      webviewProvider,
    ),
  );

  // --- CodeLens Provider ---
  codeLensProvider = new DeckgraphCodeLensProvider();
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      [
        { scheme: 'file', language: 'javascript' },
        { scheme: 'file', language: 'typescript' },
        { scheme: 'file', language: 'python' },
        { scheme: 'file', language: 'go' },
        { scheme: 'file', language: 'rust' },
        { scheme: 'file', language: 'java' },
      ],
      codeLensProvider,
    ),
  );

  // --- Backend Ready Handler ---
  context.subscriptions.push(
    backendManager.onReady(() => {
      connectWs();
    }),
  );

  // --- Decorations on active editor change ---
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        applyDecorations(editor, currentViewResult);
      }
    }),
  );

  // --- Commands ---
  context.subscriptions.push(
    vscode.commands.registerCommand('deckgraph.start', () => {
      vscode.window.showInformationMessage('Deckgraph: Starting backend...');
      backendManager?.start();
    }),

    vscode.commands.registerCommand('deckgraph.scan', () => {
      if (!wsClient || wsClient.getStatus() !== 'connected') {
        vscode.window.showWarningMessage(
          'Deckgraph: Backend is not connected. Run "Deckgraph: Start" first.',
        );
        return;
      }
      const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      wsClient.send({ type: 'scan_project', requestId });
      vscode.window.showInformationMessage('Deckgraph: Scan initiated.');
    }),

    vscode.commands.registerCommand('deckgraph.showDashboard', () => {
      webviewProvider?.reload();
      vscode.commands.executeCommand('deckgraph.dashboard.focus');
    }),

    vscode.commands.registerCommand('deckgraph.openModule', (modulePath?: string) => {
      if (!modulePath) {
        vscode.window.showWarningMessage('Deckgraph: No module path provided.');
        return;
      }
      const uri = vscode.Uri.file(modulePath);
      vscode.workspace.openTextDocument(uri).then(
        (doc) => vscode.window.showTextDocument(doc),
        () => {
          vscode.window.showInformationMessage(
            `Deckgraph: Module "${modulePath}" — file not found locally.`,
          );
        },
      );
    }),

    vscode.commands.registerCommand('deckgraph.refreshTree', () => {
      treeProvider?.refresh();
    }),
  );

  // --- Cleanup ---
  context.subscriptions.push({
    dispose() {
      getDecorationType().dispose();
    },
  });

  // Auto-start the backend
  backendManager.start();
}

// WS connection

function connectWs(): void {
  if (!backendManager) {
    return;
  }

  wsClient = createWsClient({
    url: backendManager.getWsUrl(),
    onMessage: handleServerMessage,
    onStatusChange: (status) => {
      if (status === 'connected') {
        vscode.window.showInformationMessage('Deckgraph: Connected to backend.');
      }
    },
  });

  wsClient.connect();
}

function handleServerMessage(message: ServerMessage): void {
  if (message.type === 'project_overview') {
    const project = message.data;

    // Map Module[] → ModuleView[]: ViewResult requires totalDependencyCount
    const moduleViews: ModuleView[] = project.modules.map((m) => ({
      path: m.path,
      name: m.name,
      ecosystem: m.ecosystem,
      analysisState: m.analysisState,
      dependencies: m.dependencies,
      totalDependencyCount: m.dependencies.length,
    }));

    // Build ViewSummary from project data
    const byScope: Record<DependencyScope, number> = {
      runtime: 0,
      dev: 0,
      build: 0,
      optional: 0,
      peer: 0,
    };
    const byEcosystem: Partial<Record<Ecosystem, number>> = {};
    for (const m of moduleViews) {
      for (const dep of m.dependencies) {
        byScope[dep.scope] = (byScope[dep.scope] ?? 0) + 1;
      }
      byEcosystem[m.ecosystem] = (byEcosystem[m.ecosystem] ?? 0) + m.totalDependencyCount;
    }

    const summary: ViewSummary = {
      totalDeps: moduleViews.reduce((sum, m) => sum + m.totalDependencyCount, 0),
      byEcosystem: byEcosystem as Record<Ecosystem, number>,
      byScope,
      outdatedCount: null,
      unusedCount: null,
      moduleCount: moduleViews.length,
      crossEdgeCount: project.crossEdges.length,
    };

    currentViewResult = {
      modules: moduleViews,
      crossEdges: project.crossEdges,
      summary,
    };

    treeProvider?.updateModules(moduleViews);
    codeLensProvider?.updateViewResult(currentViewResult);

    const editor = vscode.window.activeTextEditor;
    if (editor) {
      applyDecorations(editor, currentViewResult);
    }
  }
}

// Deactivation

export function deactivate(): void {
  wsClient?.disconnect();
  wsClient = undefined;
  backendManager?.dispose();
  backendManager = undefined;
}
