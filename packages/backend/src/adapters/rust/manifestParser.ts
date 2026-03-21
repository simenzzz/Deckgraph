/**
 * Rust/Cargo manifest parser.
 *
 * Parses Cargo.toml and Cargo.lock files to extract declared dependencies.
 * Uses smol-toml for TOML parsing.
 */

import { readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { parse as parseTOML } from 'smol-toml';
import { z } from 'zod';
import type { ManifestResult, MinimalDependency, DependencyScope } from '@deckgraph/shared';
import { parseManifestResult } from '@deckgraph/shared';
import { createLogger } from '../../logger.js';
import { readFileSafe, uniqueDirs } from '../utils.js';

const logger = createLogger('rust-manifest-parser');

// ============================================================================
// Internal Zod Schemas
// ============================================================================

const cargoPackageSchema = z.object({
  name: z.string().optional(),
  version: z.string().optional(),
  edition: z.string().optional(),
});

const cargoWorkspaceSchema = z.object({
  members: z.array(z.string()).optional(),
});

const cargoTomlSchema = z.object({
  package: cargoPackageSchema.optional(),
  workspace: cargoWorkspaceSchema.optional(),
  dependencies: z.record(z.string(), z.unknown()).optional(),
  'dev-dependencies': z.record(z.string(), z.unknown()).optional(),
  'build-dependencies': z.record(z.string(), z.unknown()).optional(),
  features: z.record(z.string(), z.array(z.string())).optional(),
}).passthrough();

const cargoLockPackageSchema = z.object({
  name: z.string(),
  version: z.string(),
  source: z.string().optional(),
});

const cargoLockSchema = z.object({
  package: z.array(cargoLockPackageSchema).optional(),
}).passthrough();

// ============================================================================
// Scope Mapping
// ============================================================================

const SCOPE_SECTIONS: readonly {
  readonly key: 'dependencies' | 'dev-dependencies' | 'build-dependencies';
  readonly scope: DependencyScope;
}[] = [
  { key: 'dependencies', scope: 'runtime' },
  { key: 'dev-dependencies', scope: 'dev' },
  { key: 'build-dependencies', scope: 'build' },
];

// ============================================================================
// Lock File Types
// ============================================================================

interface ResolvedVersions {
  readonly versions: ReadonlyMap<string, string>;
  readonly lockFileName: string;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Parse Cargo.toml and Cargo.lock from a module directory.
 */
export async function parseRustManifests(
  projectRoot: string,
  modulePath: string,
): Promise<ManifestResult> {
  const moduleDir = join(projectRoot, modulePath);
  const cargoTomlPath = join(moduleDir, 'Cargo.toml');

  const rawContent = await readFile(cargoTomlPath, 'utf-8');
  const parsed = parseTOML(rawContent);
  const validationResult = cargoTomlSchema.safeParse(parsed);

  if (!validationResult.success) {
    const issues = validationResult.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join(', ');
    throw new Error(`Invalid Cargo.toml at ${cargoTomlPath}: ${issues}`);
  }

  const cargo = validationResult.data;
  const resolvedVersions = await tryReadCargoLock(projectRoot, moduleDir);
  const dependencies = extractDependencies(cargo, resolvedVersions);
  const moduleName = cargo.package?.name ?? basename(moduleDir);

  const result: ManifestResult = {
    moduleName,
    dependencies,
    hasLockFile: resolvedVersions !== null,
    metadata: buildMetadata(cargo),
  };

  return parseManifestResult(result);
}

// ============================================================================
// Dependency Extraction
// ============================================================================

/**
 * Extract a version constraint from a Cargo dependency value.
 * Values can be:
 * - string: "1.0" (version constraint)
 * - table: { version = "1.0", features = [...] }
 * - path-only: { path = "..." } → "*"
 * - git-only: { git = "..." } → git URL
 */
function extractConstraint(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;

    if (typeof record['version'] === 'string') {
      return record['version'];
    }

    if (typeof record['git'] === 'string') {
      return record['git'];
    }

    if (typeof record['path'] === 'string') {
      return '*';
    }
  }

  return '*';
}

/**
 * Extract dependencies from all scope sections.
 */
function extractDependencies(
  cargo: z.infer<typeof cargoTomlSchema>,
  resolvedVersions: ResolvedVersions | null,
): readonly MinimalDependency[] {
  const deps: MinimalDependency[] = [];

  for (const { key, scope } of SCOPE_SECTIONS) {
    const section = cargo[key];
    if (!section) continue;

    for (const [name, value] of Object.entries(section)) {
      const constraint = extractConstraint(value);
      const version = resolvedVersions?.versions.get(name) ?? constraint;

      deps.push({
        name,
        version,
        constraint,
        scope,
      });
    }
  }

  return deps;
}

// ============================================================================
// Cargo.lock Parsing
// ============================================================================

/**
 * Try to read and parse Cargo.lock from module dir or project root.
 */
async function tryReadCargoLock(
  projectRoot: string,
  moduleDir: string,
): Promise<ResolvedVersions | null> {
  const lockFileName = 'Cargo.lock';

  for (const dir of uniqueDirs(moduleDir, projectRoot)) {
    const lockPath = join(dir, lockFileName);
    const content = await readFileSafe(lockPath);
    if (content === null) continue;

    try {
      const parsed = parseTOML(content);
      const result = cargoLockSchema.safeParse(parsed);
      if (!result.success) {
        logger.warn({ lockPath }, 'Malformed Cargo.lock, skipping');
        continue;
      }

      const versions = parseCargoLockPackages(result.data.package ?? []);
      return { versions, lockFileName };
    } catch {
      logger.warn({ lockPath }, 'Failed to parse Cargo.lock, skipping');
    }
  }

  return null;
}

/**
 * Parse Cargo.lock [[package]] entries.
 * Only includes entries with a `source` field (skips local workspace members).
 */
function parseCargoLockPackages(
  packages: readonly z.infer<typeof cargoLockPackageSchema>[],
): ReadonlyMap<string, string> {
  const versions = new Map<string, string>();

  for (const pkg of packages) {
    if (!pkg.source) continue;
    versions.set(pkg.name, pkg.version);
  }

  return versions;
}

// ============================================================================
// Metadata
// ============================================================================

function buildMetadata(cargo: z.infer<typeof cargoTomlSchema>): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};

  if (cargo.package?.version) {
    metadata['packageVersion'] = cargo.package.version;
  }

  if (cargo.package?.edition) {
    metadata['edition'] = cargo.package.edition;
  }

  if (cargo.features) {
    metadata['features'] = Object.keys(cargo.features);
  }

  if (cargo.workspace?.members) {
    metadata['workspaceMembers'] = cargo.workspace.members;
  }

  return metadata;
}
