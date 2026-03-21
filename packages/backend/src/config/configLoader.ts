/**
 * Loads and validates .deckgraph.yaml project configuration.
 *
 * Reads the config file from the project root, parses YAML,
 * validates with Zod, and converts kebab-case keys to camelCase.
 * Returns null if the config file does not exist.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { z } from 'zod';
import type { ProjectConfig } from '@deckgraph/shared';
import { createLogger } from '../logger.js';

const logger = createLogger('configLoader');

const CONFIG_FILENAME = '.deckgraph.yaml';

/**
 * Error thrown when .deckgraph.yaml exists but contains invalid content.
 */
export class DeckgraphConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeckgraphConfigError';
  }
}

/**
 * Internal Zod schema for the raw YAML file.
 * Uses kebab-case keys matching the file format, strict() to catch typos.
 */
const rawConfigSchema = z
  .object({
    'ignore-paths': z
      .array(z.string().min(1).max(512))
      .max(256)
      .default([]),
    'concern-overrides': z
      .record(
        z.string().min(1).max(512),
        z.array(z.string().min(1).max(128)).max(64),
      )
      .default({}),
  })
  .strict();

/**
 * Load and validate .deckgraph.yaml from the given project root.
 * Returns null if the file does not exist.
 * Throws DeckgraphConfigError if the file exists but is invalid.
 */
export async function loadConfig(projectRoot: string): Promise<ProjectConfig | null> {
  const configPath = join(projectRoot, CONFIG_FILENAME);

  let rawContent: string;
  try {
    rawContent = await readFile(configPath, 'utf-8');
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      logger.debug({ configPath }, 'No .deckgraph.yaml found');
      return null;
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(rawContent);
  } catch {
    throw new DeckgraphConfigError(
      `Failed to parse ${CONFIG_FILENAME}: invalid YAML syntax`,
    );
  }

  // Empty YAML file → null document
  if (parsed == null) {
    return { ignorePaths: [], concernOverrides: {} };
  }

  const result = rawConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new DeckgraphConfigError(
      `Invalid ${CONFIG_FILENAME}:\n${issues}`,
    );
  }

  return {
    ignorePaths: result.data['ignore-paths'],
    concernOverrides: result.data['concern-overrides'],
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
