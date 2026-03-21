/**
 * Java manifest parser.
 *
 * Parses pom.xml (with fast-xml-parser), build.gradle / build.gradle.kts
 * (with regex), and gradle.lockfile for version resolution.
 *
 * Priority: pom.xml > build.gradle > build.gradle.kts
 */

import { join, basename } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';
import type { ManifestResult, MinimalDependency, DependencyScope } from '@deckgraph/shared';
import { parseManifestResult } from '@deckgraph/shared';
import { createLogger } from '../../logger.js';
import { readFileSafe, uniqueDirs } from '../utils.js';

const logger = createLogger('java-manifest-parser');

// ============================================================================
// Internal Zod Schemas
// ============================================================================

const mavenDependencySchema = z.object({
  groupId: z.string(),
  artifactId: z.string(),
  version: z.union([z.string(), z.number()]).optional(),
  scope: z.string().optional(),
  optional: z.union([z.boolean(), z.string()]).optional(),
});

const pomXmlSchema = z.object({
  project: z.object({
    artifactId: z.string().optional(),
    groupId: z.string().optional(),
    packaging: z.string().optional(),
    properties: z.record(z.string(), z.unknown()).optional(),
    dependencies: z.object({
      dependency: z.union([mavenDependencySchema, z.array(mavenDependencySchema)]).optional(),
    }).optional(),
  }),
}).passthrough();

// ============================================================================
// Scope Mapping
// ============================================================================

const MAVEN_SCOPE_MAP: Record<string, DependencyScope> = {
  compile: 'runtime',
  runtime: 'runtime',
  test: 'dev',
  provided: 'build',
  system: 'build',
};

const GRADLE_SCOPE_MAP: Record<string, DependencyScope> = {
  implementation: 'runtime',
  runtimeOnly: 'runtime',
  api: 'runtime',
  testImplementation: 'dev',
  testRuntimeOnly: 'dev',
  compileOnly: 'build',
  annotationProcessor: 'build',
};

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
 * Parse Java manifest (pom.xml or build.gradle) and lock files.
 * Priority: pom.xml > build.gradle > build.gradle.kts
 */
export async function parseJavaManifests(
  projectRoot: string,
  modulePath: string,
): Promise<ManifestResult> {
  const moduleDir = join(projectRoot, modulePath);

  // Try pom.xml first
  const pomContent = await readFileSafe(join(moduleDir, 'pom.xml'));
  if (pomContent !== null) {
    return parsePomXml(pomContent, projectRoot, moduleDir);
  }

  // Try build.gradle
  const gradleContent = await readFileSafe(join(moduleDir, 'build.gradle'));
  if (gradleContent !== null) {
    return parseGradleFile(gradleContent, projectRoot, moduleDir, 'gradle');
  }

  // Try build.gradle.kts
  const gradleKtsContent = await readFileSafe(join(moduleDir, 'build.gradle.kts'));
  if (gradleKtsContent !== null) {
    return parseGradleFile(gradleKtsContent, projectRoot, moduleDir, 'gradle');
  }

  throw new Error(`No Java manifest found in ${moduleDir} (tried pom.xml, build.gradle, build.gradle.kts)`);
}

// ============================================================================
// pom.xml Parsing
// ============================================================================

/**
 * Parse a pom.xml file.
 */
async function parsePomXml(
  content: string,
  projectRoot: string,
  moduleDir: string,
): Promise<ManifestResult> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    isArray: (_name, jpath) => jpath === 'project.dependencies.dependency',
    processEntities: false,
  });

  const raw = parser.parse(content) as unknown;
  const validationResult = pomXmlSchema.safeParse(raw);

  if (!validationResult.success) {
    const issues = validationResult.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join(', ');
    throw new Error(`Invalid pom.xml at ${join(moduleDir, 'pom.xml')}: ${issues}`);
  }

  const pom = validationResult.data.project;
  const properties = pom.properties ?? {};
  const resolvedVersions = await tryReadGradleLock(projectRoot, moduleDir);

  const rawDeps = pom.dependencies?.dependency;
  const depsArray = rawDeps ? (Array.isArray(rawDeps) ? rawDeps : [rawDeps]) : [];

  const dependencies: MinimalDependency[] = depsArray.map((dep) => {
    const name = `${dep.groupId}:${dep.artifactId}`;
    const rawVersion = dep.version !== undefined ? String(dep.version) : 'managed';
    const constraint = interpolateProperties(rawVersion, properties);
    const isOptional = dep.optional === true || dep.optional === 'true';
    const scope: DependencyScope = isOptional
      ? 'optional'
      : (MAVEN_SCOPE_MAP[dep.scope ?? 'compile'] ?? 'runtime');
    const version = resolvedVersions?.versions.get(name) ?? constraint;

    return { name, version, constraint, scope };
  });

  const moduleName = pom.artifactId ?? basename(moduleDir);

  const result: ManifestResult = {
    moduleName,
    dependencies,
    hasLockFile: resolvedVersions !== null,
    metadata: buildMavenMetadata(pom),
  };

  return parseManifestResult(result);
}

/**
 * Interpolate ${property} references in version strings.
 * Single-level only — nested references are not resolved.
 */
function interpolateProperties(
  value: string,
  properties: Record<string, unknown>,
): string {
  return value.replace(/\$\{([^}]+)\}/g, (_match, key: string) => {
    const resolved = properties[key];
    if (resolved !== undefined && resolved !== null) {
      return String(resolved);
    }
    logger.warn({ property: key }, 'Unresolved Maven property');
    return `\${${key}}`;
  });
}

// ============================================================================
// build.gradle / build.gradle.kts Parsing
// ============================================================================

/**
 * Extract dependencies from a Gradle build file using regex.
 * Documented limitation: only catches common dependency declaration patterns.
 */
async function parseGradleFile(
  content: string,
  projectRoot: string,
  moduleDir: string,
  buildTool: string,
): Promise<ManifestResult> {
  const resolvedVersions = await tryReadGradleLock(projectRoot, moduleDir);
  const dependencies = extractGradleDeps(content, resolvedVersions);
  const moduleName = extractGradleModuleName(content) ?? basename(moduleDir);

  const result: ManifestResult = {
    moduleName,
    dependencies,
    hasLockFile: resolvedVersions !== null,
    metadata: { buildTool },
  };

  return parseManifestResult(result);
}

function extractGradleDeps(
  content: string,
  resolvedVersions: ResolvedVersions | null,
): readonly MinimalDependency[] {
  const deps: MinimalDependency[] = [];
  let match: RegExpExecArray | null;

  // Regex created per-call to avoid shared mutable state from the `g` flag
  const pattern = /\b(implementation|testImplementation|compileOnly|runtimeOnly|api|testRuntimeOnly|annotationProcessor)\s*[\s(]+['"]([^'"]+)['"]\)?/g;

  while ((match = pattern.exec(content)) !== null) {
    const config = match[1]!;
    const coordinate = match[2]!;

    const parts = coordinate.split(':');
    if (parts.length < 2) continue;

    const name = `${parts[0]}:${parts[1]}`;
    const constraint = parts[2] ?? '*';
    const scope = GRADLE_SCOPE_MAP[config] ?? 'runtime';
    const version = resolvedVersions?.versions.get(name) ?? constraint;

    deps.push({ name, version, constraint, scope });
  }

  return deps;
}

/**
 * Try to extract module name from Gradle file.
 */
function extractGradleModuleName(content: string): string | null {
  const rootNameMatch = content.match(/rootProject\.name\s*=\s*['"]([^'"]+)['"]/);
  if (rootNameMatch) return rootNameMatch[1]!;

  const archivesMatch = content.match(/archivesBaseName\s*=\s*['"]([^'"]+)['"]/);
  if (archivesMatch) return archivesMatch[1]!;

  return null;
}

// ============================================================================
// gradle.lockfile Parsing
// ============================================================================

/**
 * Try to read and parse gradle.lockfile from module dir or project root.
 */
async function tryReadGradleLock(
  projectRoot: string,
  moduleDir: string,
): Promise<ResolvedVersions | null> {
  const lockFileName = 'gradle.lockfile';

  for (const dir of uniqueDirs(moduleDir, projectRoot)) {
    const lockPath = join(dir, lockFileName);
    const content = await readFileSafe(lockPath);
    if (content === null) continue;

    try {
      const versions = parseGradleLockfile(content);
      return { versions, lockFileName };
    } catch {
      logger.warn({ lockPath }, 'Failed to parse gradle.lockfile, skipping');
    }
  }

  return null;
}

/**
 * Parse gradle.lockfile content.
 * Format: `group:artifact:version=config1,config2`
 * Skip # comments and empty= marker.
 */
function parseGradleLockfile(content: string): ReadonlyMap<string, string> {
  const versions = new Map<string, string>();

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (line === 'empty=') continue;

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;

    const coordinate = line.slice(0, eqIdx);
    const parts = coordinate.split(':');
    if (parts.length < 3) continue;

    const name = `${parts[0]}:${parts[1]}`;
    const version = parts[2]!;
    versions.set(name, version);
  }

  return versions;
}

// ============================================================================
// Metadata
// ============================================================================

function buildMavenMetadata(
  pom: z.infer<typeof pomXmlSchema>['project'],
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};

  if (pom.groupId) {
    metadata['groupId'] = pom.groupId;
  }

  if (pom.packaging) {
    metadata['packaging'] = pom.packaging;
  }

  metadata['buildTool'] = 'maven';

  return metadata;
}
