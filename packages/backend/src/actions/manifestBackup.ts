/**
 * In-memory backup and restore of manifest and lock files.
 *
 * Before executing a package manager command, we read all manifest
 * and lock files into memory. On failure, we write them back.
 * This is simpler and more reliable than git-stash.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { createLogger } from '../logger.js';

const logger = createLogger('manifestBackup');

/**
 * In-memory snapshot of manifest and lock files.
 */
export interface ManifestBackup {
  /** Map of absolute file path → file content */
  readonly files: ReadonlyMap<string, string>;
}

/** Well-known lock files that should be backed up alongside manifests. */
const LOCK_FILES = [
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'poetry.lock',
  'Pipfile.lock',
  'go.sum',
  'Cargo.lock',
];

/**
 * Read manifest and lock files into memory for backup.
 *
 * @param cwd - Absolute path to the module directory
 * @param manifestFiles - Manifest filenames (e.g., ["package.json"])
 * @param projectRoot - Absolute project root (for root-level lock files)
 */
export function backupManifests(
  cwd: string,
  manifestFiles: readonly string[],
  projectRoot: string,
): ManifestBackup {
  const files = new Map<string, string>();

  // Backup manifest files in the module directory
  for (const manifest of manifestFiles) {
    const absPath = path.join(cwd, manifest);
    if (existsSync(absPath)) {
      files.set(absPath, readFileSync(absPath, 'utf-8'));
    }
  }

  // Backup lock files in both module dir and project root
  const searchDirs = [cwd];
  if (cwd !== projectRoot) {
    searchDirs.push(projectRoot);
  }

  for (const dir of searchDirs) {
    for (const lockFile of LOCK_FILES) {
      const absPath = path.join(dir, lockFile);
      if (existsSync(absPath) && !files.has(absPath)) {
        files.set(absPath, readFileSync(absPath, 'utf-8'));
      }
    }
  }

  logger.debug({ fileCount: files.size, cwd }, 'Manifest backup created');
  return { files };
}

/**
 * Restore all backed-up files to their original state.
 */
export function restoreManifests(backup: ManifestBackup): void {
  for (const [absPath, content] of backup.files) {
    try {
      writeFileSync(absPath, content, 'utf-8');
    } catch (error) {
      logger.error(
        { path: absPath, error: error instanceof Error ? error.message : String(error) },
        'Failed to restore manifest file',
      );
    }
  }
  logger.info({ fileCount: backup.files.size }, 'Manifest backup restored');
}
