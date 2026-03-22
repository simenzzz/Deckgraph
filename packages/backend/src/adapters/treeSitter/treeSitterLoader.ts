/**
 * Tree-sitter WASM loader singleton.
 *
 * Initializes web-tree-sitter once and lazily loads grammar WASM files
 * per language. Thread-safe via singleton promises.
 */

import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { Parser, Language } from 'web-tree-sitter';
import { createLogger } from '../../logger.js';

const require = createRequire(import.meta.url);

const logger = createLogger('tree-sitter');

export type SupportedLanguage = 'python' | 'go' | 'rust' | 'java';

/** Singleton: Parser.init() called once */
let initPromise: Promise<void> | null = null;

/** Cached languages: one WASM load per language */
const languageCache = new Map<SupportedLanguage, Promise<Language>>();

/**
 * Initialize web-tree-sitter (singleton, idempotent).
 */
export async function initTreeSitter(): Promise<void> {
  if (!initPromise) {
    initPromise = Parser.init().then(() => {
      logger.info('web-tree-sitter initialized');
    });
  }
  return initPromise;
}

/**
 * Get a Parser configured for the given language.
 * Initializes web-tree-sitter and loads the grammar WASM lazily.
 *
 * @param language - One of: 'python', 'go', 'rust', 'java'
 * @returns A configured Parser instance (caller should not share across threads)
 */
export async function getParser(language: SupportedLanguage): Promise<Parser> {
  await initTreeSitter();

  const lang = await loadLanguage(language);
  const parser = new Parser();
  parser.setLanguage(lang);
  return parser;
}

/**
 * Load a language grammar WASM (cached per language).
 */
async function loadLanguage(language: SupportedLanguage): Promise<Language> {
  const cached = languageCache.get(language);
  if (cached) return cached;

  const wasmPath = resolveWasmPath(language);
  const promise = Language.load(wasmPath).then((lang) => {
    logger.info({ language }, 'Grammar loaded');
    return lang;
  });

  languageCache.set(language, promise);
  return promise;
}

/**
 * Resolve the filesystem path to a grammar WASM file.
 * Uses Node's require.resolve for reliable package resolution.
 */
function resolveWasmPath(language: SupportedLanguage): string {
  const packageName = `tree-sitter-${language}`;
  const packageJsonPath = require.resolve(`${packageName}/package.json`);
  const packageDir = dirname(packageJsonPath);
  return join(packageDir, `${packageName}.wasm`);
}

/**
 * Reset the loader state (for testing).
 */
export function resetTreeSitter(): void {
  initPromise = null;
  languageCache.clear();
}
