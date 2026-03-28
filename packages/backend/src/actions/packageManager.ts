/**
 * Package manager facade.
 *
 * Orchestrates the validate → backup → execute → re-scan cycle
 * for all package management actions. Handles rollback on failure.
 */

import path from 'node:path';

import type {
  Ecosystem,
  Module,
  PackageActionResult,
  DependencyScope,
} from '@deckgraph/shared';
import { createLogger } from '../logger.js';
import { backupManifests, restoreManifests } from './manifestBackup.js';
import {
  validateUpdateRequest,
  validateInstallRequest,
  validateRemoveRequest,
} from './validators.js';
import type { ExecutorContext, ExecutorRegistry } from './types.js';

const logger = createLogger('packageManager');

export interface PackageManagerDeps {
  readonly executorRegistry: ExecutorRegistry;
  readonly projectRoot: string;
}

function buildContext(projectRoot: string, modulePath: string): ExecutorContext {
  const cwd = path.join(projectRoot, modulePath);
  const resolved = path.resolve(cwd);
  const resolvedRoot = path.resolve(projectRoot);

  // Guard against path traversal — cwd must be under projectRoot
  if (!resolved.startsWith(resolvedRoot + path.sep) && resolved !== resolvedRoot) {
    throw new Error(`Path traversal detected: "${modulePath}" resolves outside project root`);
  }

  return {
    projectRoot,
    modulePath,
    cwd: resolved,
  };
}

/**
 * Update a dependency to a specific version.
 */
export async function updatePackage(
  deps: PackageManagerDeps,
  module: Module,
  packageName: string,
  targetVersion: string,
): Promise<PackageActionResult> {
  const { executorRegistry, projectRoot } = deps;

  const executor = executorRegistry.get(module.ecosystem);
  if (!executor) {
    return failResult('update', module, packageName, `No executor for ecosystem: ${module.ecosystem}`);
  }

  const validation = validateUpdateRequest(module, packageName, targetVersion);
  if (!validation.valid) {
    return failResult('update', module, packageName, validation.error!);
  }

  const dep = module.dependencies.find((d) => d.name === packageName);
  const previousVersion = dep?.version ?? null;
  const ctx = buildContext(projectRoot, module.path);
  const backup = backupManifests(ctx.cwd, module.manifests, projectRoot);

  logger.info(
    { ecosystem: module.ecosystem, packageName, targetVersion, modulePath: module.path },
    'Updating package',
  );

  const result = await executor.update(ctx, {
    packageName,
    targetVersion,
    scope: dep?.scope ?? 'runtime',
  });

  if (result.status === 'failure') {
    logger.warn({ packageName, error: result.error }, 'Update failed, restoring manifests');
    restoreManifests(backup);
    return { ...result, status: 'rolled-back', previousVersion };
  }

  return { ...result, previousVersion };
}

/**
 * Install a new dependency.
 */
export async function installPackage(
  deps: PackageManagerDeps,
  module: Module,
  packageName: string,
  ecosystem: Ecosystem,
  version: string | null,
  scope: DependencyScope,
): Promise<PackageActionResult> {
  const { executorRegistry, projectRoot } = deps;

  const executor = executorRegistry.get(ecosystem);
  if (!executor) {
    return failResult('install', module, packageName, `No executor for ecosystem: ${ecosystem}`);
  }

  const validation = validateInstallRequest(module, packageName, version);
  if (!validation.valid) {
    return failResult('install', module, packageName, validation.error!);
  }

  const ctx = buildContext(projectRoot, module.path);
  const backup = backupManifests(ctx.cwd, module.manifests, projectRoot);

  logger.info(
    { ecosystem, packageName, version, modulePath: module.path },
    'Installing package',
  );

  const result = await executor.install(ctx, { packageName, version, scope });

  if (result.status === 'failure') {
    logger.warn({ packageName, error: result.error }, 'Install failed, restoring manifests');
    restoreManifests(backup);
    return { ...result, status: 'rolled-back' };
  }

  return result;
}

/**
 * Remove a dependency.
 */
export async function removePackage(
  deps: PackageManagerDeps,
  module: Module,
  packageName: string,
): Promise<PackageActionResult> {
  const { executorRegistry, projectRoot } = deps;

  const executor = executorRegistry.get(module.ecosystem);
  if (!executor) {
    return failResult('remove', module, packageName, `No executor for ecosystem: ${module.ecosystem}`);
  }

  const validation = validateRemoveRequest(module, packageName);
  if (!validation.valid) {
    return failResult('remove', module, packageName, validation.error!);
  }

  const dep = module.dependencies.find((d) => d.name === packageName);
  const previousVersion = dep?.version ?? null;
  const ctx = buildContext(projectRoot, module.path);
  const backup = backupManifests(ctx.cwd, module.manifests, projectRoot);

  logger.info(
    { ecosystem: module.ecosystem, packageName, modulePath: module.path },
    'Removing package',
  );

  const result = await executor.remove(ctx, { packageName });

  if (result.status === 'failure') {
    logger.warn({ packageName, error: result.error }, 'Remove failed, restoring manifests');
    restoreManifests(backup);
    return { ...result, status: 'rolled-back', previousVersion };
  }

  return { ...result, previousVersion };
}

function failResult(
  action: 'update' | 'install' | 'remove',
  module: Module,
  packageName: string,
  error: string,
): PackageActionResult {
  return {
    action,
    ecosystem: module.ecosystem,
    packageName,
    modulePath: module.path,
    status: 'failure',
    previousVersion: null,
    newVersion: null,
    error,
    command: '',
  };
}
