/**
 * Go import analyzer using web-tree-sitter.
 *
 * Detects:
 * - `import "path"` (single import)
 * - `import ( "path1"\n"path2" )` (grouped import)
 *
 * Third-party classification: stdlib has no dot in path.
 */

import type { ParsedImport } from '@deckgraph/shared';
import { getParser } from '../treeSitter/treeSitterLoader.js';

/**
 * Analyze a Go source file for import statements.
 *
 * @param filePath - Path to the file (for error context)
 * @param source - The Go source code
 * @returns Immutable array of parsed imports
 */
export async function analyzeGoImports(
  _filePath: string,
  source: string,
): Promise<readonly ParsedImport[]> {
  const parser = await getParser('go');
  const tree = parser.parse(source);
  if (!tree) return [];
  const root = tree.rootNode;
  const imports: ParsedImport[] = [];

  for (let i = 0; i < root.childCount; i++) {
    const node = root.child(i);
    if (!node || node.type !== 'import_declaration') continue;

    // import_declaration contains either:
    // - a single import_spec
    // - an import_spec_list with multiple import_specs
    for (let j = 0; j < node.childCount; j++) {
      const child = node.child(j);
      if (!child) continue;

      if (child.type === 'import_spec') {
        const imp = fromImportSpec(child);
        if (imp) imports.push(imp);
      }

      if (child.type === 'import_spec_list') {
        for (let k = 0; k < child.childCount; k++) {
          const spec = child.child(k);
          if (spec?.type === 'import_spec') {
            const imp = fromImportSpec(spec);
            if (imp) imports.push(imp);
          }
        }
      }
    }
  }

  return imports;
}

/**
 * Extract import info from a single import_spec node.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromImportSpec(node: any): ParsedImport | null {
  const pathNode = node.childForFieldName('path');
  if (!pathNode) return null;

  // Remove surrounding quotes from the interpreted_string_literal
  const rawPath: string = pathNode.text;
  const source = rawPath.replace(/^"|"$/g, '');

  if (!source) return null;

  // Check for alias (named import)
  const nameNode = node.childForFieldName('name');
  const alias = nameNode ? nameNode.text : null;

  // Get the last segment as the default specifier
  const segments = source.split('/');
  const lastSegment = segments[segments.length - 1] ?? source;

  return {
    source,
    specifiers: alias && alias !== '.' && alias !== '_'
      ? [alias]
      : [lastSegment],
    isThirdParty: isGoThirdParty(source),
    line: node.startPosition.row + 1,
  };
}

/**
 * Determine if a Go import is third-party.
 *
 * Go convention:
 * - stdlib paths have no dots: "fmt", "net/http", "encoding/json"
 * - third-party paths have a domain: "github.com/...", "golang.org/x/..."
 */
function isGoThirdParty(importPath: string): boolean {
  const firstSegment = importPath.split('/')[0]!;
  return firstSegment.includes('.');
}
