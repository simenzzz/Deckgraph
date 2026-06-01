/**
 * Go manifest parser.
 *
 * Parses go.mod and go.sum files to extract declared dependencies.
 * go.mod is parsed line-by-line with regex (not a TOML/JSON parser).
 */

import { readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import type { ManifestResult, MinimalDependency } from '@deckgraph/shared';
import { parseManifestResult } from '@deckgraph/shared';
import { createLogger } from '../../logger.js';
import { readFileSafe, uniqueDirs } from '../utils.js';

const logger = createLogger('go-manifest-parser');

interface GoModRequire {
  readonly path: string;
  readonly version: string;
  readonly indirect: boolean;
}

// Lock File Types

interface ResolvedVersions {
  readonly versions: ReadonlyMap<string, string>;
  readonly lockFileName: string;
}

// Public API

/**
 * Parse go.mod and go.sum from a module directory.
 */
export async function parseGoManifests(
  projectRoot: string,
  modulePath: string,
): Promise<ManifestResult> {
  const moduleDir = join(projectRoot, modulePath);
  const goModPath = join(moduleDir, 'go.mod');

  const rawContent = await readFile(goModPath, 'utf-8');
  const parsed = parseGoMod(rawContent);

  const resolvedVersions = await tryReadGoSum(projectRoot, moduleDir);
  const dependencies = buildDependencies(parsed.requires, parsed.replaces, resolvedVersions);
  const moduleName = parsed.modulePath.split('/').pop() ?? basename(moduleDir);

  const result: ManifestResult = {
    moduleName,
    dependencies,
    hasLockFile: resolvedVersions !== null,
    metadata: buildMetadata(parsed),
  };

  return parseManifestResult(result);
}

// go.mod Parsing

interface GoModParsed {
  readonly modulePath: string;
  readonly goVersion: string | null;
  readonly requires: readonly GoModRequire[];
  readonly replaces: ReadonlyMap<string, { readonly path: string; readonly version: string }>;
}

/**
 * Parse go.mod content line-by-line.
 */
function parseGoMod(content: string): GoModParsed {
  const lines = content.split('\n');
  let modulePath = '';
  let goVersion: string | null = null;
  const requires: GoModRequire[] = [];
  const replaces = new Map<string, { path: string; version: string }>();

  let inRequireBlock = false;
  let inReplaceBlock = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Module path
    const moduleMatch = line.match(/^module\s+(.+)$/);
    if (moduleMatch) {
      modulePath = moduleMatch[1]!.trim();
      continue;
    }

    // Go version
    const goVersionMatch = line.match(/^go\s+(\S+)$/);
    if (goVersionMatch) {
      goVersion = goVersionMatch[1]!;
      continue;
    }

    // Require block start
    if (line === 'require (') {
      inRequireBlock = true;
      continue;
    }

    // Replace block start
    if (line === 'replace (') {
      inReplaceBlock = true;
      continue;
    }

    // Block end
    if (line === ')') {
      inRequireBlock = false;
      inReplaceBlock = false;
      continue;
    }

    // Single-line require
    const singleRequireMatch = line.match(/^require\s+(\S+)\s+(\S+)(.*)$/);
    if (singleRequireMatch) {
      const indirect = singleRequireMatch[3]?.includes('// indirect') ?? false;
      requires.push({
        path: singleRequireMatch[1]!,
        version: singleRequireMatch[2]!,
        indirect,
      });
      continue;
    }

    // Require inside block
    if (inRequireBlock) {
      const blockRequireMatch = line.match(/^(\S+)\s+(\S+)(.*)$/);
      if (blockRequireMatch) {
        const indirect = blockRequireMatch[3]?.includes('// indirect') ?? false;
        requires.push({
          path: blockRequireMatch[1]!,
          version: blockRequireMatch[2]!,
          indirect,
        });
      }
      continue;
    }

    // Replace directive (single-line or inside block)
    const replaceLineMatch = inReplaceBlock
      ? line.match(/^(\S+)(?:\s+\S+)?\s+=>\s+(\S+)\s+(\S+)$/)
      : line.match(/^replace\s+(\S+)(?:\s+\S+)?\s+=>\s+(\S+)\s+(\S+)$/);

    if (replaceLineMatch) {
      const newPath = replaceLineMatch[2]!;
      // Skip local path replacements
      if (newPath.startsWith('./') || newPath.startsWith('../') || newPath.startsWith('/')) {
        continue;
      }
      replaces.set(replaceLineMatch[1]!, { path: newPath, version: replaceLineMatch[3]! });
    }
  }

  return { modulePath, goVersion, requires, replaces };
}

// go.sum Parsing

/**
 * Try to read and parse go.sum from module dir or project root.
 */
async function tryReadGoSum(
  projectRoot: string,
  moduleDir: string,
): Promise<ResolvedVersions | null> {
  const lockFileName = 'go.sum';

  for (const dir of uniqueDirs(moduleDir, projectRoot)) {
    const lockPath = join(dir, lockFileName);
    const content = await readFileSafe(lockPath);
    if (content === null) continue;

    try {
      const versions = parseGoSum(content);
      return { versions, lockFileName };
    } catch {
      logger.warn({ lockPath }, 'Failed to parse go.sum, skipping');
    }
  }

  return null;
}

/**
 * Parse go.sum content.
 * Lines: `<path> <version> <hash>` and `<path> <version>/go.mod <hash>`.
 * Deduplicates `/go.mod` entries.
 */
function parseGoSum(content: string): ReadonlyMap<string, string> {
  const versions = new Map<string, string>();

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const parts = line.split(/\s+/);
    if (parts.length < 3) continue;

    const name = parts[0]!;
    let version = parts[1]!;

    // Strip /go.mod suffix from version
    if (version.endsWith('/go.mod')) {
      version = version.slice(0, -'/go.mod'.length);
    }

    // Only set the first occurrence (prefer non-go.mod entry)
    if (!versions.has(name)) {
      versions.set(name, version);
    }
  }

  return versions;
}

// Dependency Building

/**
 * Build dependencies list applying replacements and resolved versions.
 */
function buildDependencies(
  requires: readonly GoModRequire[],
  replaces: ReadonlyMap<string, { readonly path: string; readonly version: string }>,
  resolvedVersions: ResolvedVersions | null,
): readonly MinimalDependency[] {
  return requires.map((req) => {
    const replacement = replaces.get(req.path);
    const name = replacement?.path ?? req.path;
    const constraint = replacement?.version ?? req.version;
    const version = resolvedVersions?.versions.get(name) ?? constraint;

    return {
      name,
      version,
      constraint,
      scope: 'runtime' as const,
    };
  });
}

// Metadata

function buildMetadata(parsed: GoModParsed): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};

  if (parsed.goVersion) {
    metadata['goVersion'] = parsed.goVersion;
  }

  metadata['modulePath'] = parsed.modulePath;

  return metadata;
}
