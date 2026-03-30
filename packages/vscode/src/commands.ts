/**
 * Command registration for the Deckgraph extension.
 *
 * All commands are registered in extension.ts via registerCommands().
 */

import * as vscode from 'vscode';
import type { BackendManager } from './backendManager';
import type { WsClient } from './backendWsClient';

export interface CommandContext {
  readonly backendManager: BackendManager;
  readonly getWsClient: () => WsClient | undefined;
  readonly treeProvider: import('./treeDataProvider').ModuleTreeProvider;
  readonly webviewProvider: import('./webviewProvider').DeckgraphWebviewProvider;
}

/**
 * Register all Deckgraph commands and return disposables.
 */
export function registerCommands(ctx: CommandContext): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('deckgraph.start', () => {
      vscode.window.showInformationMessage('Deckgraph: Starting backend...');
      ctx.backendManager.start();
    }),

    vscode.commands.registerCommand('deckgraph.scan', () => {
      const wsClient = ctx.getWsClient();
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
      ctx.webviewProvider.reload();
      vscode.commands.executeCommand('deckgraph.dashboard.focus');
    }),

    vscode.commands.registerCommand('deckgraph.openModule', (modulePath?: string) => {
      if (!modulePath) {
        vscode.window.showWarningMessage('Deckgraph: No module path provided.');
        return;
      }

      // Try to open the manifest file for this module
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
      ctx.treeProvider.refresh();
    }),
  ];
}
