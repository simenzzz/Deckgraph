/**
 * CodeLens provider showing "Used in N files" on import lines.
 *
 * Detects import/require/use statements in source files and
 * shows a CodeLens with usage information from the dependency graph.
 */

import * as vscode from 'vscode';
import type { ViewResult } from '@deckgraph/shared';

/** Regex patterns for import statements across ecosystems. */
const IMPORT_PATTERNS = [
  // JS/TS: import ... from 'pkg' or require('pkg')
  /(?:import\s+.*?\s+from|require)\s*\(?['"]([^'"]+)['"]\)?/,
  // Python: import pkg / from pkg import ...
  /(?:import|from)\s+([a-zA-Z0-9_.]+)/,
  // Go: import "pkg"
  /"([^"]+)"/,
  // Rust: use pkg::
  /use\s+([a-zA-Z0-9_]+)::/,
  // Java: import pkg.
  /import\s+([a-zA-Z0-9_.]+)/,
];

export class DeckgraphCodeLensProvider implements vscode.CodeLensProvider {
  private readonly _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  private viewResult: ViewResult | null = null;

  /** Update the view result and trigger refresh. */
  updateViewResult(result: ViewResult | null): void {
    this.viewResult = result;
    this._onDidChangeCodeLenses.fire();
  }

  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken,
  ): vscode.CodeLens[] {
    if (!this.viewResult) {
      return [];
    }

    const lenses: vscode.CodeLens[] = [];
    const lines = document.getText().split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) {
        continue;
      }

      const packageName = extractPackageName(line);
      if (!packageName) {
        continue;
      }

      // Find the dependency in the view result
      const dep = this.findDependency(packageName);
      if (!dep) {
        continue;
      }

      const range = new vscode.Range(i, 0, i, line.length);
      lenses.push(
        new vscode.CodeLens(range, {
          title: `v${dep.version}`,
          command: '',
        }),
      );
    }

    return lenses;
  }

  private findDependency(packageName: string): { version: string } | null {
    if (!this.viewResult) {
      return null;
    }

    for (const mod of this.viewResult.modules) {
      const dep = mod.dependencies.find((d) => d.name === packageName);
      if (dep) {
        return { version: dep.version };
      }
    }

    return null;
  }
}

/**
 * Extract a package name from an import line.
 */
function extractPackageName(line: string): string | null {
  for (const pattern of IMPORT_PATTERNS) {
    const match = pattern.exec(line);
    if (match) {
      // Return the first segment (before /) for scoped packages
      const name = match[1];
      return name.split('/')[0].split('.')[0];
    }
  }
  return null;
}
