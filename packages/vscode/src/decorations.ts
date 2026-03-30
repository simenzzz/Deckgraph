/**
 * Inline decorations for dependency manifest files.
 *
 * Detects known manifest filenames, parses dependency lines,
 * and adds inline decorations showing the installed version.
 */

import * as vscode from 'vscode';
import type { ViewResult } from '@deckgraph/shared';

const MANIFEST_PATTERNS = [
  /package\.json$/,
  /requirements\.txt$/,
  /Pipfile$/,
  /pyproject\.toml$/,
  /Cargo\.toml$/,
  /go\.mod$/,
  /pom\.xml$/,
];

/** Check if a document is a recognized manifest file. */
function isManifestFile(uri: vscode.Uri): boolean {
  return MANIFEST_PATTERNS.some((p) => p.test(uri.fsPath));
}

const decorationType = vscode.window.createTextEditorDecorationType({
  after: {
    color: new vscode.ThemeColor('editorCodeLens.foreground'),
    margin: '0 0 0 1em',
    fontStyle: 'italic',
  },
});

interface DecorationEntry {
  readonly line: number;
  readonly version: string;
}

/**
 * Build decorations for a manifest file based on the current view result.
 */
function buildDecorations(
  document: vscode.TextDocument,
  viewResult: ViewResult,
): DecorationEntry[] {
  const entries: DecorationEntry[] = [];
  const text = document.getText();
  const lines = text.split('\n');

  // Find the module matching this document's path
  const docPath = document.uri.fsPath;
  const module = viewResult.modules.find((m) => docPath.includes(m.path));
  if (!module) {
    return entries;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    for (const dep of module.dependencies) {
      // Match dependency name in the line
      if (line.includes(dep.name)) {
        entries.push({
          line: i,
          version: dep.version || dep.constraint,
        });
        break;
      }
    }
  }

  return entries;
}

/**
 * Apply decorations to the active editor if it's a manifest file.
 */
export function applyDecorations(
  editor: vscode.TextEditor,
  viewResult: ViewResult | null,
): void {
  if (!viewResult || !isManifestFile(editor.document.uri)) {
    editor.setDecorations(decorationType, []);
    return;
  }

  const entries = buildDecorations(editor.document, viewResult);
  const decorations: vscode.DecorationOptions[] = entries.map((entry) => ({
    range: editor.document.lineAt(entry.line).range,
    renderOptions: {
      after: {
        contentText: ` resolved: ${entry.version}`,
      },
    },
  }));

  editor.setDecorations(decorationType, decorations);
}

/**
 * Get the decoration type for cleanup.
 */
export function getDecorationType(): vscode.TextEditorDecorationType {
  return decorationType;
}
