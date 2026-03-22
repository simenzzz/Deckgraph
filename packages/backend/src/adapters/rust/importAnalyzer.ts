/**
 * Rust import analyzer using web-tree-sitter.
 *
 * Detects:
 * - `use crate_name::Item;`
 * - `use crate_name::{A, B};`
 * - `use crate_name::*;`
 * - `extern crate name;`
 *
 * Filters out: std, core, alloc, self, super, crate.
 */

import type { ParsedImport } from '@deckgraph/shared';
import { getParser } from '../treeSitter/treeSitterLoader.js';

/** Rust built-in crate prefixes that are never third-party */
const RUST_BUILTINS: ReadonlySet<string> = new Set([
  'std',
  'core',
  'alloc',
  'self',
  'super',
  'crate',
]);

/**
 * Analyze a Rust source file for use/extern crate statements.
 *
 * @param filePath - Path to the file (for error context)
 * @param source - The Rust source code
 * @returns Immutable array of parsed imports
 */
export async function analyzeRustImports(
  _filePath: string,
  source: string,
): Promise<readonly ParsedImport[]> {
  const parser = await getParser('rust');
  const tree = parser.parse(source);
  if (!tree) return [];
  const root = tree.rootNode;
  const imports: ParsedImport[] = [];

  for (let i = 0; i < root.childCount; i++) {
    const node = root.child(i);
    if (!node) continue;

    if (node.type === 'use_declaration') {
      const result = fromUseDeclaration(node);
      if (result) imports.push(result);
    }

    if (node.type === 'extern_crate_declaration') {
      const result = fromExternCrate(node);
      if (result) imports.push(result);
    }
  }

  return imports;
}

/**
 * Extract import info from a `use` declaration.
 * e.g., `use serde::Deserialize;` or `use tokio::{spawn, time};`
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromUseDeclaration(node: any): ParsedImport | null {
  // The use_declaration has an argument child which is a scoped_identifier,
  // use_wildcard, or scoped_use_list
  const arg = node.childForFieldName('argument');
  if (!arg) return null;

  const { crateName, specifiers } = extractUsePath(arg);
  if (!crateName) return null;

  return {
    source: crateName,
    specifiers: specifiers.length > 0 ? specifiers : [crateName],
    isThirdParty: isRustThirdParty(crateName),
    line: node.startPosition.row + 1,
  };
}

/**
 * Extract crate name and specifiers from a use path tree-sitter node.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractUsePath(node: any): {
  crateName: string | null;
  specifiers: string[];
} {
  // Simple identifier: `use serde;`
  if (node.type === 'identifier') {
    return { crateName: node.text, specifiers: [node.text] };
  }

  // Scoped identifier: `use serde::Deserialize;`
  if (node.type === 'scoped_identifier') {
    const fullPath: string = node.text;
    const parts = fullPath.split('::');
    const crateName = parts[0]!;
    const lastPart = parts[parts.length - 1]!;
    return { crateName, specifiers: [lastPart] };
  }

  // Use wildcard: `use serde::*;`
  if (node.type === 'use_wildcard') {
    const fullPath: string = node.text;
    const parts = fullPath.split('::');
    const crateName = parts[0]!;
    return { crateName, specifiers: ['*'] };
  }

  // Scoped use list: `use serde::{Deserialize, Serialize};`
  if (node.type === 'scoped_use_list') {
    const pathNode = node.childForFieldName('path');
    const listNode = node.childForFieldName('list');

    if (!pathNode) return { crateName: null, specifiers: [] };

    const pathText: string = pathNode.text;
    const parts = pathText.split('::');
    const crateName = parts[0]!;

    const specifiers: string[] = [];
    if (listNode) {
      for (let i = 0; i < listNode.childCount; i++) {
        const child = listNode.child(i);
        if (child && (child.type === 'identifier' || child.type === 'scoped_identifier')) {
          // For scoped identifiers in list, take the last segment
          const childParts = child.text.split('::');
          specifiers.push(childParts[childParts.length - 1]!);
        }
        if (child?.type === 'use_as_clause') {
          const nameNode = child.childForFieldName('path');
          if (nameNode) {
            const childParts = nameNode.text.split('::');
            specifiers.push(childParts[childParts.length - 1]!);
          }
        }
      }
    }

    return { crateName, specifiers };
  }

  // Use as clause: `use serde::Deserialize as De;`
  if (node.type === 'use_as_clause') {
    const pathNode = node.childForFieldName('path');
    if (!pathNode) return { crateName: null, specifiers: [] };
    const fullPath: string = pathNode.text;
    const parts = fullPath.split('::');
    const crateName = parts[0]!;
    const lastPart = parts[parts.length - 1]!;
    return { crateName, specifiers: [lastPart] };
  }

  return { crateName: null, specifiers: [] };
}

/**
 * Extract crate name from an `extern crate` declaration.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromExternCrate(node: any): ParsedImport | null {
  const nameNode = node.childForFieldName('name');
  if (!nameNode) return null;

  const crateName: string = nameNode.text;

  return {
    source: crateName,
    specifiers: [crateName],
    isThirdParty: isRustThirdParty(crateName),
    line: node.startPosition.row + 1,
  };
}

/**
 * Determine if a Rust crate is third-party.
 */
function isRustThirdParty(crateName: string): boolean {
  return !RUST_BUILTINS.has(crateName);
}
