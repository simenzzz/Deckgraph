/**
 * JS/TS manifest parser.
 *
 * Parses package.json and lock files (pnpm-lock.yaml v9, package-lock.json v3)
 * to extract declared dependencies with resolved versions.
 */

import { readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import yaml from 'js-yaml';
import { z } from 'zod';
import type { ManifestResult, MinimalDependency, DependencyScope } from '@deckgraph/shared';
import { parseManifestResult } from '@deckgraph/shared';
import { createLogger } from '../../logger.js';
import { readFileSafe, uniqueDirs } from '../utils.js';

const logger = createLogger('js-manifest-parser');

// Internal Zod Schemas (validate raw file formats)

const packageJsonSchema = z
  .object({
    name: z.string().optional(),
    version: z.string().optional(),
    dependencies: z.record(z.string(), z.string()).optional(),
    devDependencies: z.record(z.string(), z.string()).optional(),
    peerDependencies: z.record(z.string(), z.string()).optional(),
    optionalDependencies: z.record(z.string(), z.string()).optional(),
    workspaces: z
      .union([z.array(z.string()), z.object({ packages: z.array(z.string()) })])
      .optional(),
    scripts: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

const pnpmLockSchema = z.object({
  lockfileVersion: z.union([z.string(), z.number()]),
  packages: z.record(z.string(), z.object({ version: z.string().optional() }).passthrough()).optional(),
});

const npmLockSchema = z.object({
  lockfileVersion: z.number(),
  packages: z.record(z.string(), z.object({ version: z.string().optional() }).passthrough()).optional(),
});

type PackageJson = z.infer<typeof packageJsonSchema>;

// Lock File Types

interface ResolvedVersions {
  readonly versions: ReadonlyMap<string, string>;
  readonly lockFileName: string;
}

// Scope Mapping

const SCOPE_SECTIONS: readonly {
  readonly key: keyof Pick<PackageJson, 'dependencies' | 'devDependencies' | 'peerDependencies' | 'optionalDependencies'>;
  readonly scope: DependencyScope;
}[] = [
  { key: 'dependencies', scope: 'runtime' },
  { key: 'devDependencies', scope: 'dev' },
  { key: 'peerDependencies', scope: 'peer' },
  { key: 'optionalDependencies', scope: 'optional' },
];

// Public API

/**
 * Parse package.json and lock files from a module directory.
 *
 * @param projectRoot - Absolute path to the project root
 * @param modulePath - Relative path from project root to the module directory
 * @returns Validated ManifestResult
 */
export async function parseJsManifests(
  projectRoot: string,
  modulePath: string,
): Promise<ManifestResult> {
  const moduleDir = join(projectRoot, modulePath);
  const packageJsonPath = join(moduleDir, 'package.json');

  const rawJson = await readFile(packageJsonPath, 'utf-8');
  const parsed = JSON.parse(rawJson) as unknown;
  const validationResult = packageJsonSchema.safeParse(parsed);

  if (!validationResult.success) {
    const issues = validationResult.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join(', ');
    throw new Error(`Invalid package.json at ${packageJsonPath}: ${issues}`);
  }

  const pkg = validationResult.data;
  const resolvedVersions = await tryReadLockFile(projectRoot, moduleDir);

  const dependencies = extractDependencies(pkg, resolvedVersions);
  const moduleName = pkg.name ?? basename(moduleDir);

  const result: ManifestResult = {
    moduleName,
    dependencies,
    hasLockFile: resolvedVersions !== null,
    metadata: buildMetadata(pkg),
  };

  // Defense in depth: validate output through shared schema
  return parseManifestResult(result);
}

// Dependency Extraction

/**
 * Extract dependencies from all scope sections of package.json.
 */
function extractDependencies(
  pkg: PackageJson,
  resolvedVersions: ResolvedVersions | null,
): readonly MinimalDependency[] {
  const deps: MinimalDependency[] = [];

  for (const { key, scope } of SCOPE_SECTIONS) {
    const section = pkg[key];
    if (!section) continue;

    for (const [name, constraint] of Object.entries(section)) {
      const local = isLocalProtocolRef(constraint);
      // Local deps have no registry version; fall back to '*' rather than an
      // ugly raw spec like "workspace:*" when no lock entry resolves it.
      const version = resolvedVersions?.versions.get(name) ?? (local ? '*' : constraint);

      deps.push({
        name,
        version,
        constraint,
        scope,
        ...(local ? { local: true } : {}),
      });
    }
  }

  return deps;
}

/**
 * Protocol prefixes that mark a dependency as local/workspace rather than a
 * registry package: pnpm/yarn `workspace:`, and the `file:`/`link:`/`portal:`
 * local path protocols. Such deps aren't published to npm.
 */
const LOCAL_PROTOCOL_PREFIXES = ['workspace:', 'file:', 'link:', 'portal:'] as const;

/**
 * Check if a version constraint points at a local/workspace package.
 */
function isLocalProtocolRef(constraint: string): boolean {
  return LOCAL_PROTOCOL_PREFIXES.some((prefix) => constraint.startsWith(prefix));
}

// Lock File Reading

/**
 * Try to read and parse a lock file.
 * Checks pnpm-lock.yaml first (in module dir, then project root),
 * then package-lock.json (same search order).
 * Returns null if no lock file found or if parsing fails.
 */
async function tryReadLockFile(
  projectRoot: string,
  moduleDir: string,
): Promise<ResolvedVersions | null> {
  // Try pnpm-lock.yaml first
  const pnpmResult = await tryPnpmLock(projectRoot, moduleDir);
  if (pnpmResult) return pnpmResult;

  // Then package-lock.json
  const npmResult = await tryNpmLock(projectRoot, moduleDir);
  if (npmResult) return npmResult;

  return null;
}

async function tryPnpmLock(
  projectRoot: string,
  moduleDir: string,
): Promise<ResolvedVersions | null> {
  const lockFileName = 'pnpm-lock.yaml';

  for (const dir of uniqueDirs(moduleDir, projectRoot)) {
    const lockPath = join(dir, lockFileName);
    const content = await readFileSafe(lockPath);
    if (content === null) continue;

    try {
      const parsed = yaml.load(content);
      const result = pnpmLockSchema.safeParse(parsed);
      if (!result.success) {
        logger.warn({ lockPath }, 'Malformed pnpm-lock.yaml, skipping');
        continue;
      }

      const lockVersion = String(result.data.lockfileVersion);
      if (!lockVersion.startsWith('9')) {
        logger.warn(
          { lockPath, lockVersion },
          'Unsupported pnpm-lock.yaml version, results may be incomplete',
        );
      }

      const versions = parsePnpmLockPackages(result.data.packages ?? {});
      return { versions, lockFileName };
    } catch {
      logger.warn({ lockPath }, 'Failed to parse pnpm-lock.yaml, skipping');
    }
  }

  return null;
}

async function tryNpmLock(
  projectRoot: string,
  moduleDir: string,
): Promise<ResolvedVersions | null> {
  const lockFileName = 'package-lock.json';

  for (const dir of uniqueDirs(moduleDir, projectRoot)) {
    const lockPath = join(dir, lockFileName);
    const content = await readFileSafe(lockPath);
    if (content === null) continue;

    try {
      const parsed = JSON.parse(content) as unknown;
      const result = npmLockSchema.safeParse(parsed);
      if (!result.success) {
        logger.warn({ lockPath }, 'Malformed package-lock.json, skipping');
        continue;
      }

      const versions = parseNpmLockPackages(result.data.packages ?? {});
      return { versions, lockFileName };
    } catch {
      logger.warn({ lockPath }, 'Failed to parse package-lock.json, skipping');
    }
  }

  return null;
}

// Lock File Parsing

/**
 * Parse pnpm-lock.yaml v9 packages record.
 * Keys are specifiers like "/@babel/core@7.24.0" or "react@18.2.0".
 */
function parsePnpmLockPackages(
  packages: Readonly<Record<string, { version?: string }>>,
): ReadonlyMap<string, string> {
  const versions = new Map<string, string>();

  for (const [key, value] of Object.entries(packages)) {
    const name = extractPnpmPackageName(key);
    if (!name) continue;

    const version = value.version ?? extractPnpmVersion(key);
    if (version) {
      versions.set(name, version);
    }
  }

  return versions;
}

/**
 * Extract package name from a pnpm lock key.
 * Handles scoped packages: "/@scope/name@1.0.0" → "@scope/name"
 * And regular packages: "/react@18.2.0" → "react"
 */
function extractPnpmPackageName(key: string): string | null {
  // Remove leading slash
  const withoutSlash = key.startsWith('/') ? key.slice(1) : key;

  // Find last @ that separates name from version
  const lastAt = withoutSlash.lastIndexOf('@');
  if (lastAt <= 0) return null;

  // Handle scoped packages: if the name starts with @, find the second @
  if (withoutSlash.startsWith('@')) {
    const secondAt = withoutSlash.indexOf('@', 1);
    if (secondAt === -1) return null;
    return withoutSlash.slice(0, secondAt);
  }

  return withoutSlash.slice(0, lastAt);
}

/**
 * Extract version from a pnpm lock key.
 */
function extractPnpmVersion(key: string): string | null {
  const withoutSlash = key.startsWith('/') ? key.slice(1) : key;
  const lastAt = withoutSlash.lastIndexOf('@');
  if (lastAt <= 0) return null;
  return withoutSlash.slice(lastAt + 1);
}

/**
 * Parse package-lock.json v3 packages record.
 * Keys are paths like "node_modules/react" or "node_modules/@scope/name".
 */
function parseNpmLockPackages(
  packages: Readonly<Record<string, { version?: string }>>,
): ReadonlyMap<string, string> {
  const versions = new Map<string, string>();
  const prefix = 'node_modules/';

  for (const [key, value] of Object.entries(packages)) {
    if (!key.startsWith(prefix)) continue;
    if (!value.version) continue;

    // Handle nested node_modules: use only the last segment
    const lastModulesIdx = key.lastIndexOf(prefix);
    const name = key.slice(lastModulesIdx + prefix.length);
    if (name) {
      versions.set(name, value.version);
    }
  }

  return versions;
}

// Metadata

/**
 * Build ecosystem-specific metadata from package.json.
 */
function buildMetadata(pkg: PackageJson): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};

  if (pkg.version) {
    metadata['packageVersion'] = pkg.version;
  }

  if (pkg.scripts) {
    metadata['scripts'] = Object.keys(pkg.scripts);
  }

  if (pkg.workspaces) {
    metadata['workspaces'] = Array.isArray(pkg.workspaces)
      ? pkg.workspaces
      : pkg.workspaces.packages;
  }

  return metadata;
}

// readFileSafe and uniqueDirs imported from ../utils.js
