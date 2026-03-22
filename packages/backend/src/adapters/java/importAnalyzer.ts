/**
 * Java import analyzer using web-tree-sitter.
 *
 * Detects:
 * - `import pkg.Class;`
 * - `import pkg.*;` (wildcard)
 * - `import static pkg.Class.method;`
 *
 * Filters out: java.*, javax.*, sun.*, jdk.*.
 */

import type { ParsedImport } from '@deckgraph/shared';
import { getParser } from '../treeSitter/treeSitterLoader.js';

/** Java stdlib package prefixes */
const JAVA_STDLIB_PREFIXES: readonly string[] = [
  'java.',
  'javax.',
  'sun.',
  'jdk.',
  'com.sun.',
];

/**
 * Analyze a Java source file for import statements.
 *
 * @param filePath - Path to the file (for error context)
 * @param source - The Java source code
 * @returns Immutable array of parsed imports
 */
export async function analyzeJavaImports(
  _filePath: string,
  source: string,
): Promise<readonly ParsedImport[]> {
  const parser = await getParser('java');
  const tree = parser.parse(source);
  if (!tree) return [];
  const root = tree.rootNode;
  const imports: ParsedImport[] = [];

  // In Java, the root node is `program` which contains import_declaration nodes
  for (let i = 0; i < root.childCount; i++) {
    const node = root.child(i);
    if (!node || node.type !== 'import_declaration') continue;

    const result = fromImportDeclaration(node);
    if (result) imports.push(result);
  }

  return imports;
}

/**
 * Extract import info from an import_declaration node.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromImportDeclaration(node: any): ParsedImport | null {
  // The full import text, e.g., "import java.util.List;" or "import static java.util.Collections.sort;"
  const fullText: string = node.text;

  // Remove "import ", optional "static ", and trailing ";"
  let importPath = fullText.replace(/^import\s+/, '').replace(/;\s*$/, '');
  const isStatic = importPath.startsWith('static ');
  if (isStatic) {
    importPath = importPath.replace(/^static\s+/, '');
  }

  if (!importPath) return null;

  // Check for wildcard
  const isWildcard = importPath.endsWith('.*');

  // Extract the class/package being imported
  const parts = importPath.split('.');
  const lastPart = parts[parts.length - 1]!;

  // The specifier is the class name (or * for wildcard)
  const specifiers = isWildcard ? ['*'] : [lastPart];

  // For Maven group:artifact mapping, we use the first 2-3 segments
  // e.g., "com.google.gson.Gson" → source is "com.google.gson"
  // The full import path is kept as source for resolution later
  const packagePath = isWildcard
    ? importPath.slice(0, -2) // Remove .*
    : parts.slice(0, -1).join('.'); // Remove class name

  return {
    source: packagePath || importPath,
    specifiers,
    isThirdParty: isJavaThirdParty(importPath),
    line: node.startPosition.row + 1,
  };
}

/**
 * Determine if a Java import is third-party.
 * Not third-party if it starts with a known stdlib prefix.
 */
function isJavaThirdParty(importPath: string): boolean {
  return !JAVA_STDLIB_PREFIXES.some((prefix) => importPath.startsWith(prefix));
}
