/**
 * Python manifest parser.
 *
 * Parses pyproject.toml (PEP 621 + Poetry), setup.cfg, requirements.txt,
 * and Pipfile to extract declared dependencies.
 *
 * Lock files: poetry.lock (TOML), Pipfile.lock (JSON).
 *
 * Priority: pyproject.toml > Pipfile > setup.cfg > requirements.txt
 */

import { join, basename } from 'node:path';
import { parse as parseTOML } from 'smol-toml';
import { z } from 'zod';
import type { ManifestResult, MinimalDependency, DependencyScope } from '@deckgraph/shared';
import { parseManifestResult } from '@deckgraph/shared';
import { createLogger } from '../../logger.js';
import { readFileSafe, uniqueDirs } from '../utils.js';

const logger = createLogger('python-manifest-parser');

// ============================================================================
// Internal Zod Schemas
// ============================================================================

const pyprojectTomlSchema = z.object({
  project: z.object({
    name: z.string().optional(),
    'requires-python': z.string().optional(),
    dependencies: z.array(z.string()).optional(),
    'optional-dependencies': z.record(z.string(), z.array(z.string())).optional(),
  }).optional(),
  'build-system': z.object({
    requires: z.array(z.string()).optional(),
  }).optional(),
  tool: z.object({
    poetry: z.object({
      name: z.string().optional(),
      dependencies: z.record(z.string(), z.unknown()).optional(),
      group: z.record(z.string(), z.object({
        dependencies: z.record(z.string(), z.unknown()).optional(),
      })).optional(),
    }).optional(),
  }).optional(),
}).passthrough();

const pipfileSchema = z.object({
  packages: z.record(z.string(), z.unknown()).optional(),
  'dev-packages': z.record(z.string(), z.unknown()).optional(),
}).passthrough();

const poetryLockPackageSchema = z.object({
  name: z.string(),
  version: z.string(),
});

const poetryLockSchema = z.object({
  package: z.array(poetryLockPackageSchema).optional(),
}).passthrough();

const pipfileLockSchema = z.object({
  default: z.record(z.string(), z.object({
    version: z.string().optional(),
  }).passthrough()).optional(),
  develop: z.record(z.string(), z.object({
    version: z.string().optional(),
  }).passthrough()).optional(),
}).passthrough();

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
 * Parse Python manifests from a module directory.
 * Priority: pyproject.toml > Pipfile > setup.cfg > requirements.txt
 */
export async function parsePythonManifests(
  projectRoot: string,
  modulePath: string,
): Promise<ManifestResult> {
  const moduleDir = join(projectRoot, modulePath);

  // Try pyproject.toml first
  const pyprojectContent = await readFileSafe(join(moduleDir, 'pyproject.toml'));
  if (pyprojectContent !== null) {
    return parsePyprojectToml(pyprojectContent, projectRoot, moduleDir);
  }

  // Try Pipfile
  const pipfileContent = await readFileSafe(join(moduleDir, 'Pipfile'));
  if (pipfileContent !== null) {
    return parsePipfile(pipfileContent, projectRoot, moduleDir);
  }

  // Try setup.cfg
  const setupCfgContent = await readFileSafe(join(moduleDir, 'setup.cfg'));
  if (setupCfgContent !== null) {
    return parseSetupCfg(setupCfgContent, projectRoot, moduleDir);
  }

  // Try requirements.txt
  const requirementsContent = await readFileSafe(join(moduleDir, 'requirements.txt'));
  if (requirementsContent !== null) {
    return parseRequirementsTxt(requirementsContent, projectRoot, moduleDir);
  }

  throw new Error(
    `No Python manifest found in ${moduleDir} (tried pyproject.toml, Pipfile, setup.cfg, requirements.txt)`,
  );
}

// ============================================================================
// PEP 508 Parser
// ============================================================================

interface Pep508Parsed {
  readonly name: string;
  readonly constraint: string;
}

/**
 * Parse a PEP 508 dependency string.
 * Examples: "requests>=2.0,<3.0", "flask[async]>=2.0; python_version>='3.8'", "numpy"
 */
function parsePep508(spec: string): Pep508Parsed {
  const trimmed = spec.trim();

  // Extract name: must start with letter/digit, can contain letters/digits/._-
  const nameMatch = trimmed.match(/^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?/);
  if (!nameMatch) {
    return { name: trimmed, constraint: '*' };
  }

  const name = nameMatch[0]!;
  let rest = trimmed.slice(name.length).trim();

  // Skip extras bracket: [extra1,extra2]
  if (rest.startsWith('[')) {
    const closeBracket = rest.indexOf(']');
    if (closeBracket !== -1) {
      rest = rest.slice(closeBracket + 1).trim();
    }
  }

  // Strip environment markers: everything after ;
  const markerIdx = rest.indexOf(';');
  if (markerIdx !== -1) {
    rest = rest.slice(0, markerIdx).trim();
  }

  const constraint = rest || '*';

  return { name, constraint };
}

// ============================================================================
// pyproject.toml Parsing
// ============================================================================

/**
 * Parse pyproject.toml content. Detects PEP 621 vs Poetry layout.
 */
async function parsePyprojectToml(
  content: string,
  projectRoot: string,
  moduleDir: string,
): Promise<ManifestResult> {
  const parsed = parseTOML(content);
  const validationResult = pyprojectTomlSchema.safeParse(parsed);

  if (!validationResult.success) {
    const issues = validationResult.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join(', ');
    throw new Error(`Invalid pyproject.toml at ${join(moduleDir, 'pyproject.toml')}: ${issues}`);
  }

  const pyproject = validationResult.data;
  const isPoetry = pyproject.tool?.poetry !== undefined;

  const resolvedVersions = isPoetry
    ? await tryReadPoetryLock(projectRoot, moduleDir)
    : await tryReadPipfileLock(projectRoot, moduleDir);

  const dependencies = isPoetry
    ? extractPoetryDeps(pyproject, resolvedVersions)
    : extractPep621Deps(pyproject, resolvedVersions);

  const moduleName = isPoetry
    ? (pyproject.tool?.poetry?.name ?? basename(moduleDir))
    : (pyproject.project?.name ?? basename(moduleDir));

  const metadata: Record<string, unknown> = {
    manifestFormat: isPoetry ? 'poetry' : 'pep621',
  };

  if (pyproject.project?.['requires-python']) {
    metadata['pythonVersion'] = pyproject.project['requires-python'];
  }

  if (pyproject['build-system']) {
    metadata['buildSystem'] = 'pyproject.toml';
  }

  if (pyproject.project?.['optional-dependencies']) {
    metadata['extras'] = Object.keys(pyproject.project['optional-dependencies']);
  }

  const result: ManifestResult = {
    moduleName,
    dependencies,
    hasLockFile: resolvedVersions !== null,
    metadata,
  };

  return parseManifestResult(result);
}

/**
 * Extract deps from PEP 621 pyproject.toml.
 */
function extractPep621Deps(
  pyproject: z.infer<typeof pyprojectTomlSchema>,
  resolvedVersions: ResolvedVersions | null,
): readonly MinimalDependency[] {
  const deps: MinimalDependency[] = [];

  // project.dependencies → runtime
  for (const spec of pyproject.project?.dependencies ?? []) {
    const { name, constraint } = parsePep508(spec);
    const version = resolvedVersions?.versions.get(normalizePypiName(name)) ?? constraint;
    deps.push({ name, version, constraint, scope: 'runtime' });
  }

  // project.optional-dependencies.* → optional
  const optDeps = pyproject.project?.['optional-dependencies'] ?? {};
  for (const extras of Object.values(optDeps)) {
    for (const spec of extras) {
      const { name, constraint } = parsePep508(spec);
      const version = resolvedVersions?.versions.get(normalizePypiName(name)) ?? constraint;
      deps.push({ name, version, constraint, scope: 'optional' });
    }
  }

  // build-system.requires → build
  for (const spec of pyproject['build-system']?.requires ?? []) {
    const { name, constraint } = parsePep508(spec);
    const version = resolvedVersions?.versions.get(normalizePypiName(name)) ?? constraint;
    deps.push({ name, version, constraint, scope: 'build' });
  }

  return deps;
}

/**
 * Extract deps from Poetry pyproject.toml.
 */
function extractPoetryDeps(
  pyproject: z.infer<typeof pyprojectTomlSchema>,
  resolvedVersions: ResolvedVersions | null,
): readonly MinimalDependency[] {
  const deps: MinimalDependency[] = [];
  const poetry = pyproject.tool?.poetry;
  if (!poetry) return deps;

  // tool.poetry.dependencies → runtime (filter out "python")
  for (const [name, value] of Object.entries(poetry.dependencies ?? {})) {
    if (name.toLowerCase() === 'python') continue;
    const constraint = extractPoetryConstraint(value);
    const version = resolvedVersions?.versions.get(normalizePypiName(name)) ?? constraint;
    deps.push({ name, version, constraint, scope: 'runtime' });
  }

  // tool.poetry.group.*.dependencies → scope based on group name
  for (const [groupName, group] of Object.entries(poetry.group ?? {})) {
    const scope: DependencyScope = groupName === 'dev' ? 'dev' : 'optional';
    for (const [name, value] of Object.entries(group.dependencies ?? {})) {
      const constraint = extractPoetryConstraint(value);
      const version = resolvedVersions?.versions.get(normalizePypiName(name)) ?? constraint;
      deps.push({ name, version, constraint, scope });
    }
  }

  return deps;
}

/**
 * Extract a version constraint from a Poetry dependency value.
 */
function extractPoetryConstraint(value: unknown): string {
  if (typeof value === 'string') return value;

  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    if (typeof record['version'] === 'string') return record['version'];
  }

  return '*';
}

// ============================================================================
// requirements.txt Parsing
// ============================================================================

/**
 * Parse requirements.txt content.
 */
async function parseRequirementsTxt(
  content: string,
  projectRoot: string,
  moduleDir: string,
): Promise<ManifestResult> {
  const resolvedVersions = await tryReadPipfileLock(projectRoot, moduleDir);
  const dependencies: MinimalDependency[] = [];

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();

    // Skip blanks, comments, includes, editable installs, options
    if (!line || line.startsWith('#') || line.startsWith('-r') || line.startsWith('-e') || line.startsWith('--')) {
      continue;
    }

    // Strip inline comments
    const commentIdx = line.indexOf(' #');
    const spec = commentIdx !== -1 ? line.slice(0, commentIdx).trim() : line;

    if (!spec) continue;

    const { name, constraint } = parsePep508(spec);
    const version = resolvedVersions?.versions.get(normalizePypiName(name)) ?? constraint;
    dependencies.push({ name, version, constraint, scope: 'runtime' });
  }

  const result: ManifestResult = {
    moduleName: basename(moduleDir),
    dependencies,
    hasLockFile: resolvedVersions !== null,
    metadata: { manifestFormat: 'requirements.txt' },
  };

  return parseManifestResult(result);
}

// ============================================================================
// Pipfile Parsing
// ============================================================================

/**
 * Parse Pipfile content (TOML).
 */
async function parsePipfile(
  content: string,
  projectRoot: string,
  moduleDir: string,
): Promise<ManifestResult> {
  const parsed = parseTOML(content);
  const validationResult = pipfileSchema.safeParse(parsed);

  if (!validationResult.success) {
    const issues = validationResult.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join(', ');
    throw new Error(`Invalid Pipfile at ${join(moduleDir, 'Pipfile')}: ${issues}`);
  }

  const pipfile = validationResult.data;
  const resolvedVersions = await tryReadPipfileLock(projectRoot, moduleDir);
  const dependencies: MinimalDependency[] = [];

  // [packages] → runtime
  for (const [name, value] of Object.entries(pipfile.packages ?? {})) {
    const constraint = extractPipfileConstraint(value);
    const version = resolvedVersions?.versions.get(normalizePypiName(name)) ?? constraint;
    dependencies.push({ name, version, constraint, scope: 'runtime' });
  }

  // [dev-packages] → dev
  for (const [name, value] of Object.entries(pipfile['dev-packages'] ?? {})) {
    const constraint = extractPipfileConstraint(value);
    const version = resolvedVersions?.versions.get(normalizePypiName(name)) ?? constraint;
    dependencies.push({ name, version, constraint, scope: 'dev' });
  }

  const result: ManifestResult = {
    moduleName: basename(moduleDir),
    dependencies,
    hasLockFile: resolvedVersions !== null,
    metadata: { manifestFormat: 'pipfile' },
  };

  return parseManifestResult(result);
}

/**
 * Extract a version constraint from a Pipfile dependency value.
 */
function extractPipfileConstraint(value: unknown): string {
  if (typeof value === 'string') return value;

  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    if (typeof record['version'] === 'string') return record['version'];
  }

  return '*';
}

// ============================================================================
// setup.cfg Parsing
// ============================================================================

/**
 * Parse setup.cfg content using Python configparser-compatible logic.
 * The `ini` npm package doesn't handle Python's multi-line continuation lines,
 * so we parse manually.
 */
async function parseSetupCfg(
  content: string,
  projectRoot: string,
  moduleDir: string,
): Promise<ManifestResult> {
  const sections = parseConfigParserFormat(content);
  const resolvedVersions = await tryReadPipfileLock(projectRoot, moduleDir);
  const dependencies: MinimalDependency[] = [];

  const options = sections['options'] ?? {};
  const metadata = sections['metadata'] ?? {};

  // install_requires → runtime
  for (const spec of splitMultiline(options['install_requires'])) {
    const { name, constraint } = parsePep508(spec);
    const version = resolvedVersions?.versions.get(normalizePypiName(name)) ?? constraint;
    dependencies.push({ name, version, constraint, scope: 'runtime' });
  }

  // setup_requires → build
  for (const spec of splitMultiline(options['setup_requires'])) {
    const { name, constraint } = parsePep508(spec);
    const version = resolvedVersions?.versions.get(normalizePypiName(name)) ?? constraint;
    dependencies.push({ name, version, constraint, scope: 'build' });
  }

  // options.extras_require sections → optional
  const extrasRequire = sections['options.extras_require'] ?? {};
  for (const value of Object.values(extrasRequire)) {
    for (const spec of splitMultiline(value)) {
      const { name, constraint } = parsePep508(spec);
      const version = resolvedVersions?.versions.get(normalizePypiName(name)) ?? constraint;
      dependencies.push({ name, version, constraint, scope: 'optional' });
    }
  }

  const moduleName = metadata['name'] ?? basename(moduleDir);

  const result: ManifestResult = {
    moduleName,
    dependencies,
    hasLockFile: resolvedVersions !== null,
    metadata: { manifestFormat: 'setup.cfg', buildSystem: 'setuptools' },
  };

  return parseManifestResult(result);
}

/**
 * Parse a Python configparser-format file.
 * Handles [section] headers, key = value pairs, and continuation lines
 * (lines starting with whitespace are appended to the previous value).
 */
function parseConfigParserFormat(
  content: string,
): Record<string, Record<string, string>> {
  const sections: Record<string, Record<string, string>> = {};
  let currentSection = '';
  let currentKey = '';

  for (const rawLine of content.split('\n')) {
    // Section header
    const sectionMatch = rawLine.match(/^\[([^\]]+)\]/);
    if (sectionMatch) {
      currentSection = sectionMatch[1]!;
      if (!sections[currentSection]) {
        sections[currentSection] = {};
      }
      currentKey = '';
      continue;
    }

    // Skip comments and blank lines (at column 0)
    if (rawLine.match(/^[#;]/) || rawLine.trim() === '') {
      continue;
    }

    // Continuation line (starts with whitespace)
    if (rawLine.match(/^\s/) && currentSection && currentKey) {
      const trimmed = rawLine.trim();
      if (trimmed) {
        const section = sections[currentSection]!;
        const prev = section[currentKey] ?? '';
        section[currentKey] = prev ? `${prev}\n${trimmed}` : trimmed;
      }
      continue;
    }

    // Key = value pair
    const kvMatch = rawLine.match(/^([^=:]+)[=:](.*)$/);
    if (kvMatch && currentSection) {
      currentKey = kvMatch[1]!.trim();
      const value = kvMatch[2]!.trim();
      sections[currentSection]![currentKey] = value;
    }
  }

  return sections;
}

/**
 * Split a multi-line configparser value into individual non-empty lines.
 */
function splitMultiline(value: string | undefined): readonly string[] {
  if (!value) return [];
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

// ============================================================================
// Lock File Parsing
// ============================================================================

/**
 * Try to read poetry.lock from module dir or project root.
 */
async function tryReadPoetryLock(
  projectRoot: string,
  moduleDir: string,
): Promise<ResolvedVersions | null> {
  const lockFileName = 'poetry.lock';

  for (const dir of uniqueDirs(moduleDir, projectRoot)) {
    const lockPath = join(dir, lockFileName);
    const content = await readFileSafe(lockPath);
    if (content === null) continue;

    try {
      const parsed = parseTOML(content);
      const result = poetryLockSchema.safeParse(parsed);
      if (!result.success) {
        logger.warn({ lockPath }, 'Malformed poetry.lock, skipping');
        continue;
      }

      const versions = new Map<string, string>();
      for (const pkg of result.data.package ?? []) {
        versions.set(normalizePypiName(pkg.name), pkg.version);
      }
      return { versions, lockFileName };
    } catch {
      logger.warn({ lockPath }, 'Failed to parse poetry.lock, skipping');
    }
  }

  return null;
}

/**
 * Try to read Pipfile.lock from module dir or project root.
 */
async function tryReadPipfileLock(
  projectRoot: string,
  moduleDir: string,
): Promise<ResolvedVersions | null> {
  const lockFileName = 'Pipfile.lock';

  for (const dir of uniqueDirs(moduleDir, projectRoot)) {
    const lockPath = join(dir, lockFileName);
    const content = await readFileSafe(lockPath);
    if (content === null) continue;

    try {
      const parsed = JSON.parse(content) as unknown;
      const result = pipfileLockSchema.safeParse(parsed);
      if (!result.success) {
        logger.warn({ lockPath }, 'Malformed Pipfile.lock, skipping');
        continue;
      }

      const versions = new Map<string, string>();

      for (const [name, entry] of Object.entries(result.data.default ?? {})) {
        if (entry.version) {
          versions.set(normalizePypiName(name), stripVersionPrefix(entry.version));
        }
      }

      for (const [name, entry] of Object.entries(result.data.develop ?? {})) {
        if (entry.version) {
          versions.set(normalizePypiName(name), stripVersionPrefix(entry.version));
        }
      }

      return { versions, lockFileName };
    } catch {
      logger.warn({ lockPath }, 'Failed to parse Pipfile.lock, skipping');
    }
  }

  return null;
}

/**
 * Strip == prefix from Pipfile.lock version strings.
 */
function stripVersionPrefix(version: string): string {
  if (version.startsWith('==')) {
    return version.slice(2);
  }
  return version;
}

/**
 * Normalize a PyPI package name for consistent lookup.
 * PEP 503: lowercased, runs of [-_.] replaced with single dash.
 */
function normalizePypiName(name: string): string {
  return name.toLowerCase().replace(/[-_.]+/g, '-');
}
