/**
 * Python import analyzer using web-tree-sitter.
 *
 * Detects:
 * - `import X` / `import X, Y`
 * - `from X import Y` / `from X import Y, Z`
 * - `from X import *`
 *
 * Filters out Python stdlib modules.
 */

import type { ParsedImport } from '@deckgraph/shared';
import { getParser } from '../treeSitter/treeSitterLoader.js';
import { PYTHON_STDLIB } from './stdlibModules.js';

/**
 * Analyze a Python source file for import statements.
 *
 * @param filePath - Path to the file (for error context)
 * @param source - The Python source code
 * @returns Immutable array of parsed imports
 */
export async function analyzePythonImports(
  _filePath: string,
  source: string,
): Promise<readonly ParsedImport[]> {
  const parser = await getParser('python');
  const tree = parser.parse(source);
  if (!tree) return [];
  const root = tree.rootNode;
  const imports: ParsedImport[] = [];

  for (let i = 0; i < root.childCount; i++) {
    const node = root.child(i);
    if (!node) continue;

    switch (node.type) {
      case 'import_statement':
        imports.push(...fromImportStatement(node));
        break;

      case 'import_from_statement':
        imports.push(...fromImportFromStatement(node));
        break;
    }
  }

  return imports;
}

/**
 * Handle `import X` / `import X, Y` / `import X as Z`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromImportStatement(node: any): ParsedImport[] {
  const results: ParsedImport[] = [];

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (!child) continue;

    if (child.type === 'dotted_name') {
      const source = child.text;
      results.push({
        source,
        specifiers: [source],
        isThirdParty: isPythonThirdParty(source),
        line: node.startPosition.row + 1,
      });
    }

    if (child.type === 'aliased_import') {
      const nameNode = child.childForFieldName('name');
      if (nameNode) {
        const source = nameNode.text;
        results.push({
          source,
          specifiers: [source],
          isThirdParty: isPythonThirdParty(source),
          line: node.startPosition.row + 1,
        });
      }
    }
  }

  return results;
}

/**
 * Handle `from X import Y` / `from X import Y, Z` / `from X import *`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromImportFromStatement(node: any): ParsedImport[] {
  const moduleNode = node.childForFieldName('module_name');
  if (!moduleNode) return [];

  const source = moduleNode.text;

  // Check for relative imports (start with dots)
  const prefixNode = node.children.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (c: any) => c.type === 'relative_import' || c.type === 'import_prefix',
  );
  const isRelative = prefixNode !== undefined || source.startsWith('.');

  const specifiers: string[] = [];

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (!child) continue;

    if (child.type === 'dotted_name' && child !== moduleNode) {
      specifiers.push(child.text);
    }

    if (child.type === 'aliased_import') {
      const nameNode = child.childForFieldName('name');
      if (nameNode) {
        specifiers.push(nameNode.text);
      }
    }

    if (child.type === 'wildcard_import') {
      specifiers.push('*');
    }
  }

  if (specifiers.length === 0) {
    specifiers.push('*');
  }

  return [
    {
      source,
      specifiers,
      isThirdParty: isRelative ? false : isPythonThirdParty(source),
      line: node.startPosition.row + 1,
    },
  ];
}

/**
 * Determine if a Python import is third-party.
 * Not third-party if it's in the Python stdlib.
 */
function isPythonThirdParty(source: string): boolean {
  // Get the top-level module name
  const topLevel = source.split('.')[0]!;
  return !PYTHON_STDLIB.has(topLevel);
}
