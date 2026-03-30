/**
 * Tree data provider for the Deckgraph module sidebar.
 *
 * Level 1: Ecosystem groups (npm, pypi, cargo, go, maven).
 * Level 2: Module names under each ecosystem.
 *
 * Subscribes to WebSocket project_overview messages to refresh the tree.
 */

import * as vscode from 'vscode';
import type { ModuleView, Ecosystem } from '@deckgraph/shared';

const ECOSYSTEM_ICONS: Record<Ecosystem, string> = {
  npm: 'package',
  pypi: 'package',
  cargo: 'package',
  go: 'package',
  maven: 'package',
};

const ECOSYSTEM_LABELS: Record<Ecosystem, string> = {
  npm: 'npm / JS / TS',
  pypi: 'PyPI / Python',
  cargo: 'Cargo / Rust',
  go: 'Go Modules',
  maven: 'Maven / Java',
};

export class ModuleTreeProvider implements vscode.TreeDataProvider<ModuleTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<ModuleTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private modules: readonly ModuleView[] = [];

  /** Update modules from a project_overview message. */
  updateModules(modules: readonly ModuleView[]): void {
    this.modules = modules;
    this._onDidChangeTreeData.fire(undefined);
  }

  /** Force a refresh of the tree view. */
  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: ModuleTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ModuleTreeItem): ModuleTreeItem[] {
    if (!element) {
      // Root: ecosystem groups
      const ecosystems = this.getEcosystemGroups();
      return ecosystems.map(
        (eco) =>
          new ModuleTreeItem(
            `${ECOSYSTEM_LABELS[eco]} (${eco})`,
            vscode.TreeItemCollapsibleState.Expanded,
            'ecosystem',
            eco,
          ),
      );
    }

    if (element.itemKind === 'ecosystem') {
      // Children: modules in this ecosystem
      return this.modules
        .filter((m) => m.ecosystem === element.ecosystem)
        .map(
          (m) =>
            new ModuleTreeItem(
              m.name,
              vscode.TreeItemCollapsibleState.None,
              'module',
              m.ecosystem,
              m.path,
            ),
        );
    }

    return [];
  }

  private getEcosystemGroups(): Ecosystem[] {
    const seen = new Set<Ecosystem>();
    for (const m of this.modules) {
      seen.add(m.ecosystem);
    }
    return Array.from(seen).sort();
  }
}

export class ModuleTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly itemKind: 'ecosystem' | 'module',
    public readonly ecosystem: Ecosystem,
    public readonly modulePath?: string,
  ) {
    super(label, collapsibleState);

    if (itemKind === 'ecosystem') {
      this.iconPath = new vscode.ThemeIcon(ECOSYSTEM_ICONS[ecosystem]);
      this.contextValue = 'ecosystem';
    } else {
      this.iconPath = new vscode.ThemeIcon('file-code');
      this.contextValue = 'module';
      this.description = `${ecosystem}`;
      this.command = {
        command: 'deckgraph.openModule',
        title: 'Open Module',
        arguments: [this.modulePath],
      };
    }
  }
}
