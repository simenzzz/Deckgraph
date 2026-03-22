/**
 * JS/TS import analyzer using @babel/parser.
 *
 * Parses a single source file and extracts all import/require statements,
 * classifying each as third-party or local.
 */

import { parse } from '@babel/parser';
import type { ParsedImport } from '@deckgraph/shared';

/**
 * Node.js built-in modules (without `node:` prefix).
 * Used to filter out stdlib imports from third-party classification.
 */
const NODE_BUILTINS: ReadonlySet<string> = new Set([
  'assert',
  'async_hooks',
  'buffer',
  'child_process',
  'cluster',
  'console',
  'constants',
  'crypto',
  'dgram',
  'diagnostics_channel',
  'dns',
  'domain',
  'events',
  'fs',
  'http',
  'http2',
  'https',
  'inspector',
  'module',
  'net',
  'os',
  'path',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'string_decoder',
  'sys',
  'test',
  'timers',
  'tls',
  'trace_events',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'wasi',
  'worker_threads',
  'zlib',
]);

/**
 * Analyze a JS/TS source file for import statements.
 *
 * Detects:
 * - `import X from 'Y'` (ESM default)
 * - `import { A, B } from 'Y'` (ESM named)
 * - `import * as X from 'Y'` (ESM namespace)
 * - `export { A } from 'Y'` (re-exports)
 * - `export * from 'Y'` (barrel re-exports)
 * - `require('Y')` (CJS)
 * - `import('Y')` (dynamic)
 *
 * @param filePath - Path to the file (used for error context, not read)
 * @param source - The source code string to parse
 * @returns Immutable array of parsed imports
 */
export function analyzeJsImports(
  filePath: string,
  source: string,
): readonly ParsedImport[] {
  const ast = parseSource(filePath, source);
  if (!ast) return [];

  const imports: ParsedImport[] = [];

  for (const node of ast.program.body) {
    switch (node.type) {
      case 'ImportDeclaration':
        imports.push(fromImportDeclaration(node));
        break;

      case 'ExportNamedDeclaration':
        if (node.source) {
          imports.push(fromExportDeclaration(node));
        }
        break;

      case 'ExportAllDeclaration':
        imports.push({
          source: node.source.value,
          specifiers: ['*'],
          isThirdParty: isThirdParty(node.source.value),
          line: node.loc?.start.line ?? 1,
        });
        break;

      default:
        break;
    }

    // Check for top-level require/import() in expression statements
    if (node.type === 'ExpressionStatement') {
      collectFromExpression(node.expression, imports);
    }

    // Check for variable declarations with require/import()
    if (node.type === 'VariableDeclaration') {
      for (const decl of node.declarations) {
        if (decl.init) {
          collectFromExpression(decl.init, imports);
        }
      }
    }
  }

  return imports;
}

/**
 * Parse source code into an AST using @babel/parser.
 * Returns null if parsing fails (logs warning via caller).
 */
function parseSource(filePath: string, source: string) {
  const isTsx = filePath.endsWith('.tsx') || filePath.endsWith('.jsx');

  const plugins: readonly string[] = [
    'typescript',
    'decorators-legacy',
    'dynamicImport',
    'importMeta',
    'classProperties',
    'classPrivateProperties',
    'classPrivateMethods',
    'topLevelAwait',
    ...(isTsx ? (['jsx'] as const) : []),
  ];

  try {
    return parse(source, {
      sourceType: 'module',
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      plugins: plugins as any[],
    });
  } catch {
    // Files that can't be parsed (e.g. invalid syntax) are skipped
    return null;
  }
}

/**
 * Extract specifiers from an ImportDeclaration node.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromImportDeclaration(node: any): ParsedImport {
  const source: string = node.source.value;
  const specifiers: string[] = [];

  for (const spec of node.specifiers) {
    switch (spec.type) {
      case 'ImportDefaultSpecifier':
        specifiers.push('default');
        break;
      case 'ImportNamespaceSpecifier':
        specifiers.push('*');
        break;
      case 'ImportSpecifier':
        specifiers.push(spec.imported.name ?? spec.imported.value);
        break;
    }
  }

  // Side-effect imports: `import 'polyfill'`
  if (specifiers.length === 0) {
    specifiers.push('side-effect');
  }

  return {
    source,
    specifiers,
    isThirdParty: isThirdParty(source),
    line: node.loc?.start.line ?? 1,
  };
}

/**
 * Extract specifiers from an ExportNamedDeclaration with source.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromExportDeclaration(node: any): ParsedImport {
  const source: string = node.source.value;
  const specifiers = node.specifiers.map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s: any) => s.exported.name ?? s.exported.value,
  );

  return {
    source,
    specifiers: specifiers.length > 0 ? specifiers : ['*'],
    isThirdParty: isThirdParty(source),
    line: node.loc?.start.line ?? 1,
  };
}

/**
 * Recursively collect require() and import() calls from expressions.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectFromExpression(expr: any, imports: ParsedImport[]): void {
  if (!expr) return;

  // require('source')
  if (
    expr.type === 'CallExpression' &&
    expr.callee?.type === 'Identifier' &&
    expr.callee.name === 'require' &&
    expr.arguments.length > 0 &&
    expr.arguments[0].type === 'StringLiteral'
  ) {
    const source: string = expr.arguments[0].value;
    imports.push({
      source,
      specifiers: ['default'],
      isThirdParty: isThirdParty(source),
      line: expr.loc?.start.line ?? 1,
    });
    return;
  }

  // import('source')
  if (
    expr.type === 'CallExpression' &&
    expr.callee?.type === 'Import' &&
    expr.arguments.length > 0 &&
    expr.arguments[0].type === 'StringLiteral'
  ) {
    const source: string = expr.arguments[0].value;
    imports.push({
      source,
      specifiers: ['default'],
      isThirdParty: isThirdParty(source),
      line: expr.loc?.start.line ?? 1,
    });
    return;
  }

  // await import('source')
  if (expr.type === 'AwaitExpression' && expr.argument) {
    collectFromExpression(expr.argument, imports);
  }
}

/**
 * Determine if an import source is a third-party package.
 *
 * Not third-party:
 * - Relative paths: './foo', '../bar'
 * - Node builtins: 'fs', 'path', 'node:fs'
 * - '#' private imports (package.json imports field)
 */
function isThirdParty(source: string): boolean {
  // Relative imports
  if (source.startsWith('.')) return false;

  // Private imports field
  if (source.startsWith('#')) return false;

  // Node builtin with node: prefix
  if (source.startsWith('node:')) return false;

  // Node builtin without prefix
  const baseName = source.includes('/') ? source.split('/')[0]! : source;
  if (NODE_BUILTINS.has(baseName)) return false;

  return true;
}
