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
import type { ProjectConfig, WorkspaceConfig } from '@deckgraph/shared';
import { workspaceConfigSchema } from '@deckgraph/shared';
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
 * Raw workspace config schema with optional roots and hooks fields.
 * All fields are optional for backward compatibility.
 */
const rawWorkspaceConfigSchema = z
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
    roots: z.array(z.string().min(1).max(1024)).max(64).optional(),
    hooks: z
      .object({
        'on-scan-complete': z.array(z.string().min(1).max(4096)).max(32).default([]),
        'on-outdated': z.array(z.string().min(1).max(4096)).max(32).default([]),
        'on-unused': z.array(z.string().min(1).max(4096)).max(32).default([]),
        'on-license-violation': z.array(z.string().min(1).max(4096)).max(32).default([]),
      })
      .strict()
      .optional(),
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

/**
 * Load and validate workspace config from the given config root.
 * Returns null if the file does not exist or has no roots field (single-project mode).
 * Throws DeckgraphConfigError if the file exists but is invalid.
 *
 * Workspace mode is detected by the presence of the 'roots' field.
 */
export async function loadWorkspaceConfig(configRoot: string): Promise<WorkspaceConfig | null> {
  const configPath = join(configRoot, CONFIG_FILENAME);

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
    return null;
  }

  const result = rawWorkspaceConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new DeckgraphConfigError(
      `Invalid ${CONFIG_FILENAME}:\n${issues}`,
    );
  }

  const data = result.data;

  // If no roots field, this is single-project mode
  if (!data.roots) {
    return null;
  }

  // Convert kebab-case hooks to camelCase HookEntry format
  const hooksConfig = data.hooks
    ? {
        onScanComplete: data.hooks['on-scan-complete'].map((cmd) => ({ cmd })),
        onOutdated: data.hooks['on-outdated'].map((cmd) => ({ cmd })),
        onUnused: data.hooks['on-unused'].map((cmd) => ({ cmd })),
        onLicenseViolation: data.hooks['on-license-violation'].map((cmd) => ({ cmd })),
      }
    : {
        onScanComplete: [],
        onOutdated: [],
        onUnused: [],
        onLicenseViolation: [],
      };

  const workspaceConfig: WorkspaceConfig = {
    ignorePaths: data['ignore-paths'],
    concernOverrides: data['concern-overrides'],
    roots: data.roots,
    hooks: hooksConfig,
  };

  // Validate with the shared schema
  return workspaceConfigSchema.parse(workspaceConfig);
}
