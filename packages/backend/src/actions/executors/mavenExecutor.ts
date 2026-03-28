/**
 * Executor for Java (Maven) ecosystem package management.
 *
 * Maven has no reliable CLI for add/remove, so this executor
 * directly edits pom.xml using fast-xml-parser. For version updates
 * it uses `mvn versions:use-dep-version` when available, with XML
 * manipulation as a fallback.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execa } from 'execa';

import type { PackageActionResult } from '@deckgraph/shared';
import type {
  EcosystemExecutor,
  ExecutorContext,
  InstallOptions,
  RemoveOptions,
  UpdateOptions,
} from '../types.js';

const SUBPROCESS_TIMEOUT_MS = 120_000; // Maven is slow

/**
 * Read pom.xml as a string. Returns null if not found.
 */
function readPom(ctx: ExecutorContext): string | null {
  const pomPath = path.join(ctx.cwd, 'pom.xml');
  if (!existsSync(pomPath)) return null;
  return readFileSync(pomPath, 'utf-8');
}

function writePom(ctx: ExecutorContext, content: string): void {
  const pomPath = path.join(ctx.cwd, 'pom.xml');
  writeFileSync(pomPath, content, 'utf-8');
}

/**
 * Update a dependency version in pom.xml via regex replacement.
 * Matches `<groupId>G</groupId>...<version>V</version>` within a <dependency> block.
 */
function updateVersionInPom(
  pom: string,
  groupId: string,
  artifactId: string,
  newVersion: string,
): { updated: string; found: boolean } {
  // Match a <dependency> block containing the groupId and artifactId
  const depRegex = new RegExp(
    `(<dependency>\\s*<groupId>${escapeRegex(groupId)}</groupId>\\s*<artifactId>${escapeRegex(artifactId)}</artifactId>\\s*<version>)[^<]*(</version>)`,
    's',
  );
  const match = depRegex.test(pom);
  if (!match) return { updated: pom, found: false };

  const updated = pom.replace(depRegex, `$1${escapeXml(newVersion)}$2`);
  return { updated, found: true };
}

/**
 * Remove a dependency block from pom.xml.
 */
function removeDependencyFromPom(
  pom: string,
  groupId: string,
  artifactId: string,
): { updated: string; found: boolean } {
  // Use a bounded character class to prevent ReDoS — match any char except '<' or match '<' only if not '</dependency>'
  // Simpler approach: match up to a reasonable limit using non-greedy with explicit bounds
  const depRegex = new RegExp(
    `\\s*<dependency>\\s*<groupId>${escapeRegex(groupId)}</groupId>\\s*<artifactId>${escapeRegex(artifactId)}</artifactId>(?:[^<]|<(?!/dependency>))*</dependency>`,
    's',
  );
  const match = depRegex.test(pom);
  if (!match) return { updated: pom, found: false };

  const updated = pom.replace(depRegex, '');
  return { updated, found: true };
}

/**
 * Add a dependency block to pom.xml inside the <dependencies> section.
 */
function addDependencyToPom(
  pom: string,
  groupId: string,
  artifactId: string,
  version: string,
  scope: string | null,
): string {
  const safeGroupId = escapeXml(groupId);
  const safeArtifactId = escapeXml(artifactId);
  const safeVersion = escapeXml(version);
  const scopeTag = scope && scope !== 'runtime'
    ? `\n      <scope>${escapeXml(scope === 'dev' ? 'test' : scope)}</scope>`
    : '';
  const depBlock = `\n    <dependency>\n      <groupId>${safeGroupId}</groupId>\n      <artifactId>${safeArtifactId}</artifactId>\n      <version>${safeVersion}</version>${scopeTag}\n    </dependency>`;

  // Insert before </dependencies>
  if (pom.includes('</dependencies>')) {
    return pom.replace('</dependencies>', `${depBlock}\n  </dependencies>`);
  }

  // If no <dependencies> section, add one before </project>
  const depsBlock = `\n  <dependencies>${depBlock}\n  </dependencies>`;
  return pom.replace('</project>', `${depsBlock}\n</project>`);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Escape XML special characters to prevent injection.
 */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Parse a Maven coordinate. Maven packages use "groupId:artifactId" format.
 */
function parseMavenCoordinate(packageName: string): { groupId: string; artifactId: string } {
  const parts = packageName.split(':');
  if (parts.length === 2) {
    return { groupId: parts[0]!, artifactId: parts[1]! };
  }
  // Fallback: treat entire name as artifactId with empty groupId
  return { groupId: '', artifactId: packageName };
}

export function createMavenExecutor(): EcosystemExecutor {
  return {
    ecosystem: 'maven',

    async update(ctx: ExecutorContext, options: UpdateOptions): Promise<PackageActionResult> {
      const { groupId, artifactId } = parseMavenCoordinate(options.packageName);

      // Try mvn versions plugin first
      const mvnArgs = [
        'versions:use-dep-version',
        `-Dincludes=${groupId}:${artifactId}`,
        `-DdepVersion=${options.targetVersion}`,
        '-DforceVersion=true',
        '-q',
      ];
      const command = `mvn ${mvnArgs.join(' ')}`;

      try {
        await execa('mvn', mvnArgs, { cwd: ctx.cwd, timeout: SUBPROCESS_TIMEOUT_MS });
        return {
          action: 'update',
          ecosystem: 'maven',
          packageName: options.packageName,
          modulePath: ctx.modulePath,
          status: 'success',
          previousVersion: null,
          newVersion: options.targetVersion,
          error: null,
          command,
        };
      } catch {
        // Fallback: direct pom.xml edit
      }

      const pom = readPom(ctx);
      if (!pom) {
        return {
          action: 'update',
          ecosystem: 'maven',
          packageName: options.packageName,
          modulePath: ctx.modulePath,
          status: 'failure',
          previousVersion: null,
          newVersion: null,
          error: 'pom.xml not found',
          command: 'edit pom.xml',
        };
      }

      const { updated, found } = updateVersionInPom(pom, groupId, artifactId, options.targetVersion);
      if (!found) {
        return {
          action: 'update',
          ecosystem: 'maven',
          packageName: options.packageName,
          modulePath: ctx.modulePath,
          status: 'failure',
          previousVersion: null,
          newVersion: null,
          error: `Dependency ${options.packageName} not found in pom.xml`,
          command: 'edit pom.xml',
        };
      }

      writePom(ctx, updated);
      return {
        action: 'update',
        ecosystem: 'maven',
        packageName: options.packageName,
        modulePath: ctx.modulePath,
        status: 'success',
        previousVersion: null,
        newVersion: options.targetVersion,
        error: null,
        command: 'edit pom.xml',
      };
    },

    async install(ctx: ExecutorContext, options: InstallOptions): Promise<PackageActionResult> {
      const { groupId, artifactId } = parseMavenCoordinate(options.packageName);
      const version = options.version ?? 'LATEST';
      const command = `edit pom.xml (add ${options.packageName}:${version})`;

      const pom = readPom(ctx);
      if (!pom) {
        return {
          action: 'install',
          ecosystem: 'maven',
          packageName: options.packageName,
          modulePath: ctx.modulePath,
          status: 'failure',
          previousVersion: null,
          newVersion: null,
          error: 'pom.xml not found',
          command,
        };
      }

      const updated = addDependencyToPom(pom, groupId, artifactId, version, options.scope);
      writePom(ctx, updated);

      return {
        action: 'install',
        ecosystem: 'maven',
        packageName: options.packageName,
        modulePath: ctx.modulePath,
        status: 'success',
        previousVersion: null,
        newVersion: version,
        error: null,
        command,
      };
    },

    async remove(ctx: ExecutorContext, options: RemoveOptions): Promise<PackageActionResult> {
      const { groupId, artifactId } = parseMavenCoordinate(options.packageName);
      const command = `edit pom.xml (remove ${options.packageName})`;

      const pom = readPom(ctx);
      if (!pom) {
        return {
          action: 'remove',
          ecosystem: 'maven',
          packageName: options.packageName,
          modulePath: ctx.modulePath,
          status: 'failure',
          previousVersion: null,
          newVersion: null,
          error: 'pom.xml not found',
          command,
        };
      }

      const { updated, found } = removeDependencyFromPom(pom, groupId, artifactId);
      if (!found) {
        return {
          action: 'remove',
          ecosystem: 'maven',
          packageName: options.packageName,
          modulePath: ctx.modulePath,
          status: 'failure',
          previousVersion: null,
          newVersion: null,
          error: `Dependency ${options.packageName} not found in pom.xml`,
          command,
        };
      }

      writePom(ctx, updated);
      return {
        action: 'remove',
        ecosystem: 'maven',
        packageName: options.packageName,
        modulePath: ctx.modulePath,
        status: 'success',
        previousVersion: null,
        newVersion: null,
        error: null,
        command,
      };
    },
  };
}
