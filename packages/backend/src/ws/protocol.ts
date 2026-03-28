/**
 * WebSocket message routing and handler dispatch.
 *
 * Zod-validates incoming messages, dispatches to the correct handler,
 * and returns a ServerMessage for the caller to send back.
 */

import { ZodError } from 'zod';
import type {
  ClientMessage,
  ServerMessage,
  ProjectOverviewMessage,
  ViewResultMessage,
  ModuleUpdatedMessage,
  DependencyEnrichedMessage,
  PackageActionResultMessage,
  PackageBatchResultMessage,
  ErrorMessage,
  Ecosystem,
  DependencyScope,
  ViewQuery,
  PackageBatchOperation,
} from '@deckgraph/shared';
import { clientMessageSchema } from '@deckgraph/shared';
import { updatePackage, installPackage, removePackage } from '../actions/packageManager.js';
import { executeBatch } from '../actions/batchExecutor.js';
import { isReasonablePackageName } from '../actions/validators.js';
import { scanProject } from '../scanner/scanner.js';
import { incrementalScan } from '../scanner/incrementalScanner.js';
import type { FileChangeEvent } from '../watcher/fileWatcher.js';
import { executeQuery } from '../graph/queryEngine.js';
import { resolveImports } from '../analysis/importResolver.js';
import { addModule } from '../graph/dependencyGraph.js';
import { createLogger } from '../logger.js';
import type { ClientConnection, ProgressEmitter, ServerState } from './types.js';

const logger = createLogger('protocol');

const VALID_TYPES = [
  'scan_project',
  'view_query',
  'sync',
  'analyze_imports',
  'enrich_dependency',
  'package_update',
  'package_install',
  'package_remove',
  'package_batch',
] as const;

/**
 * Handle a raw WebSocket message string.
 *
 * 1. Parse JSON
 * 2. Validate with Zod
 * 3. Dispatch to handler
 * 4. Return ServerMessage
 */
export async function handleMessage(
  raw: string,
  connection: ClientConnection,
  state: ServerState,
  emitProgress: ProgressEmitter,
): Promise<ServerMessage> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    logger.warn({ clientId: connection.clientId }, 'Received invalid JSON');
    return createError(
      'unknown',
      'Invalid JSON received',
      'Ensure the message is valid JSON',
    );
  }

  let parsed: ClientMessage;
  try {
    parsed = clientMessageSchema.parse(json);
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn(
        { clientId: connection.clientId, errors: error.errors },
        'Message validation failed',
      );
      return createError(
        'unknown',
        'Message validation failed',
        `Valid message types: ${VALID_TYPES.join(', ')}`,
      );
    }
    throw error;
  }

  return dispatch(parsed, state, emitProgress);
}

/**
 * Dispatch a validated client message to its handler.
 * Exhaustive switch with TypeScript never check.
 */
async function dispatch(
  message: ClientMessage,
  state: ServerState,
  emitProgress: ProgressEmitter,
): Promise<ServerMessage> {
  try {
    switch (message.type) {
      case 'scan_project':
        return await handleScanProject(message.requestId, state, emitProgress);

      case 'view_query':
        return handleViewQuery(message.requestId, message.query, state);

      case 'sync':
        return handleSync(message.requestId, state);

      case 'analyze_imports':
        return await handleAnalyzeImports(
          message.requestId,
          message.modulePath,
          state,
          emitProgress,
        );

      case 'enrich_dependency':
        return await handleEnrichDependency(
          message.requestId,
          message.ecosystem,
          message.packageName,
          state,
          emitProgress,
        );

      case 'package_update':
        return await handlePackageUpdate(
          message.requestId,
          message.ecosystem,
          message.packageName,
          message.modulePath,
          message.targetVersion,
          state,
          emitProgress,
        );

      case 'package_install':
        return await handlePackageInstall(
          message.requestId,
          message.ecosystem,
          message.packageName,
          message.modulePath,
          message.version,
          message.scope,
          state,
          emitProgress,
        );

      case 'package_remove':
        return await handlePackageRemove(
          message.requestId,
          message.ecosystem,
          message.packageName,
          message.modulePath,
          state,
          emitProgress,
        );

      case 'package_batch':
        return await handlePackageBatch(
          message.requestId,
          message.operations,
          state,
          emitProgress,
        );

      default: {
        const _exhaustive: never = message;
        return _exhaustive;
      }
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown error';
    logger.error(
      { requestId: message.requestId, error: detail },
      'Handler error',
    );
    return createError(
      message.requestId,
      'An internal error occurred while processing your request',
      'Try again or check server logs for details',
    );
  }
}

/**
 * Handle scan_project: run full scan and return project overview.
 */
async function handleScanProject(
  requestId: string,
  state: ServerState,
  emitProgress: ProgressEmitter,
): Promise<ServerMessage> {
  if (state.isScanning) {
    return createError(
      requestId,
      'A scan is already in progress',
      'Wait for the current scan to complete before starting another',
    );
  }

  state.isScanning = true;

  try {
    emitProgress(requestId, 'Starting project scan...', 0);

    const result = await scanProject({ projectRoot: state.projectRoot });

    state.scanResult = result;

    emitProgress(requestId, 'Scan complete', 1);

    const overview: ProjectOverviewMessage = {
      type: 'project_overview',
      requestId,
      data: result.project,
    };

    return overview;
  } finally {
    state.isScanning = false;
  }
}

/**
 * Handle view_query: filter the graph and return results.
 */
function handleViewQuery(
  requestId: string,
  query: ViewQuery,
  state: ServerState,
): ServerMessage {
  if (!state.scanResult) {
    return createError(
      requestId,
      'No scan data available',
      'Run a scan_project request first',
    );
  }

  const viewResult = executeQuery(state.scanResult.graph, query);

  const response: ViewResultMessage = {
    type: 'view_result',
    requestId,
    data: viewResult,
  };

  return response;
}

/**
 * Handle sync: return current project overview.
 */
function handleSync(requestId: string, state: ServerState): ServerMessage {
  if (!state.scanResult) {
    return createError(
      requestId,
      'No scan data available',
      'Run a scan_project request first',
    );
  }

  const overview: ProjectOverviewMessage = {
    type: 'project_overview',
    requestId,
    data: state.scanResult.project,
  };

  return overview;
}

/**
 * Handle analyze_imports: run import analysis on a specific module.
 */
async function handleAnalyzeImports(
  requestId: string,
  modulePath: string,
  state: ServerState,
  emitProgress: ProgressEmitter,
): Promise<ServerMessage> {
  if (!state.scanResult) {
    return createError(
      requestId,
      'No scan data available',
      'Run a scan_project request first',
    );
  }

  const module = state.scanResult.project.modules.find(
    (m) => m.path === modulePath,
  );

  if (!module) {
    return createError(
      requestId,
      `Module not found: ${modulePath}`,
      'Check the module path and ensure a scan has been completed',
    );
  }

  if (module.analysisState !== 'manifest-only') {
    return createError(
      requestId,
      `Module already analyzed: ${modulePath}`,
      'Import analysis has already been run for this module',
    );
  }

  emitProgress(requestId, `Analyzing imports for ${module.name}...`, 0);

  const result = await resolveImports(
    state.projectRoot,
    module,
    state.registry,
    state.packageMap,
  );

  // Update the graph with the analyzed module (immutably)
  const updatedGraph = addModule(
    state.scanResult.graph,
    result.updatedModule,
  );

  // Update the project modules list (immutably)
  const updatedModules = state.scanResult.project.modules.map((m) =>
    m.path === modulePath ? result.updatedModule : m,
  );

  state.scanResult = {
    project: {
      ...state.scanResult.project,
      modules: updatedModules,
    },
    graph: updatedGraph,
  };

  emitProgress(requestId, 'Import analysis complete', 1);

  const response: ModuleUpdatedMessage = {
    type: 'module_updated',
    requestId,
    module: result.updatedModule,
  };

  return response;
}

/**
 * Handle enrich_dependency: query the registry for a single dependency.
 */
async function handleEnrichDependency(
  requestId: string,
  ecosystem: Ecosystem,
  packageName: string,
  state: ServerState,
  emitProgress: ProgressEmitter,
): Promise<ServerMessage> {
  if (!state.scanResult) {
    return createError(
      requestId,
      'No scan data available',
      'Run a scan_project request first',
    );
  }

  if (!isReasonablePackageName(packageName)) {
    return createError(
      requestId,
      `Invalid package name: "${packageName}"`,
      'Package names may only contain alphanumeric characters, dots, hyphens, underscores, slashes, @, and colons',
    );
  }

  const adapter = state.registry.getAdapterForEcosystem(ecosystem);
  if (!adapter) {
    return createError(
      requestId,
      `No adapter registered for ecosystem: ${ecosystem}`,
      'Supported ecosystems: npm, pypi, go, cargo, maven',
    );
  }

  emitProgress(requestId, `Querying ${ecosystem} registry for ${packageName}...`, 0);

  const registryMeta = await adapter.queryRegistry(packageName);

  if (!registryMeta) {
    return createError(
      requestId,
      `Package not found: ${packageName}`,
      `Check the package name and ensure it exists on the ${ecosystem} registry`,
    );
  }

  // Find the dependency in the project and enrich it immutably
  let enrichedDep = null;

  const updatedModules = state.scanResult.project.modules.map((mod) => {
    const depIndex = mod.dependencies.findIndex(
      (d) => d.name === packageName && d.ecosystem === ecosystem,
    );

    if (depIndex === -1) return mod;

    const dep = mod.dependencies[depIndex]!;
    const updated = { ...dep, registryMeta };
    enrichedDep = updated;

    return {
      ...mod,
      dependencies: mod.dependencies.map((d, i) =>
        i === depIndex ? updated : d,
      ),
    };
  });

  state.scanResult = {
    ...state.scanResult,
    project: {
      ...state.scanResult.project,
      modules: updatedModules,
    },
  };

  emitProgress(requestId, 'Enrichment complete', 1);

  if (!enrichedDep) {
    return createError(
      requestId,
      `Dependency ${packageName} not found in any scanned module`,
      'Ensure the package is a declared dependency in the project',
    );
  }

  const response: DependencyEnrichedMessage = {
    type: 'dependency_enriched',
    requestId,
    dependency: enrichedDep,
  };

  return response;
}

/**
 * Handle package_update: update a dependency to a specific version.
 */
async function handlePackageUpdate(
  requestId: string,
  _ecosystem: Ecosystem,
  packageName: string,
  modulePath: string,
  targetVersion: string,
  state: ServerState,
  emitProgress: ProgressEmitter,
): Promise<ServerMessage> {
  if (!state.scanResult) {
    return createError(requestId, 'No scan data available', 'Run a scan_project request first');
  }

  const module = state.scanResult.project.modules.find((m) => m.path === modulePath);
  if (!module) {
    return createError(requestId, `Module not found: ${modulePath}`, 'Check the module path');
  }

  // Check per-module lock
  const existingLock = state.moduleActionLocks.get(modulePath);
  if (existingLock) {
    return createError(
      requestId,
      `A package operation is already in progress on "${module.name}"`,
      'Wait for the current operation to complete',
    );
  }

  state.moduleActionLocks.set(modulePath, requestId);
  try {
    emitProgress(requestId, `Updating ${packageName} to ${targetVersion}...`, 0);

    const result = await updatePackage(
      { executorRegistry: state.executorRegistry, projectRoot: state.projectRoot },
      module,
      packageName,
      targetVersion,
    );

    if (result.status === 'success') {
      emitProgress(requestId, 'Re-scanning module...', 1);
      const event = buildModuleChangeEvent(module);
      const freshScan = await incrementalScan({
        projectRoot: state.projectRoot,
        previousResult: state.scanResult,
        event,
      });
      state.scanResult = freshScan;
    }

    emitProgress(requestId, result.status === 'success' ? 'Update complete' : 'Update failed', 2);

    const response: PackageActionResultMessage = {
      type: 'package_action_result',
      requestId,
      result,
    };
    return response;
  } finally {
    state.moduleActionLocks.delete(modulePath);
  }
}

/**
 * Handle package_install: install a new dependency.
 */
async function handlePackageInstall(
  requestId: string,
  ecosystem: Ecosystem,
  packageName: string,
  modulePath: string,
  version: string | null,
  scope: DependencyScope,
  state: ServerState,
  emitProgress: ProgressEmitter,
): Promise<ServerMessage> {
  if (!state.scanResult) {
    return createError(requestId, 'No scan data available', 'Run a scan_project request first');
  }

  const module = state.scanResult.project.modules.find((m) => m.path === modulePath);
  if (!module) {
    return createError(requestId, `Module not found: ${modulePath}`, 'Check the module path');
  }

  const existingLock = state.moduleActionLocks.get(modulePath);
  if (existingLock) {
    return createError(
      requestId,
      `A package operation is already in progress on "${module.name}"`,
      'Wait for the current operation to complete',
    );
  }

  state.moduleActionLocks.set(modulePath, requestId);
  try {
    emitProgress(requestId, `Installing ${packageName}...`, 0);

    const result = await installPackage(
      { executorRegistry: state.executorRegistry, projectRoot: state.projectRoot },
      module,
      packageName,
      ecosystem,
      version,
      scope,
    );

    if (result.status === 'success') {
      emitProgress(requestId, 'Re-scanning module...', 1);
      const event = buildModuleChangeEvent(module);
      const freshScan = await incrementalScan({
        projectRoot: state.projectRoot,
        previousResult: state.scanResult,
        event,
      });
      state.scanResult = freshScan;
    }

    emitProgress(requestId, result.status === 'success' ? 'Install complete' : 'Install failed', 2);

    const response: PackageActionResultMessage = {
      type: 'package_action_result',
      requestId,
      result,
    };
    return response;
  } finally {
    state.moduleActionLocks.delete(modulePath);
  }
}

/**
 * Handle package_remove: remove a dependency.
 */
async function handlePackageRemove(
  requestId: string,
  _ecosystem: Ecosystem,
  packageName: string,
  modulePath: string,
  state: ServerState,
  emitProgress: ProgressEmitter,
): Promise<ServerMessage> {
  if (!state.scanResult) {
    return createError(requestId, 'No scan data available', 'Run a scan_project request first');
  }

  const module = state.scanResult.project.modules.find((m) => m.path === modulePath);
  if (!module) {
    return createError(requestId, `Module not found: ${modulePath}`, 'Check the module path');
  }

  const existingLock = state.moduleActionLocks.get(modulePath);
  if (existingLock) {
    return createError(
      requestId,
      `A package operation is already in progress on "${module.name}"`,
      'Wait for the current operation to complete',
    );
  }

  state.moduleActionLocks.set(modulePath, requestId);
  try {
    emitProgress(requestId, `Removing ${packageName}...`, 0);

    const result = await removePackage(
      { executorRegistry: state.executorRegistry, projectRoot: state.projectRoot },
      module,
      packageName,
    );

    if (result.status === 'success') {
      emitProgress(requestId, 'Re-scanning module...', 1);
      const event = buildModuleChangeEvent(module);
      const freshScan = await incrementalScan({
        projectRoot: state.projectRoot,
        previousResult: state.scanResult,
        event,
      });
      state.scanResult = freshScan;
    }

    emitProgress(requestId, result.status === 'success' ? 'Remove complete' : 'Remove failed', 2);

    const response: PackageActionResultMessage = {
      type: 'package_action_result',
      requestId,
      result,
    };
    return response;
  } finally {
    state.moduleActionLocks.delete(modulePath);
  }
}

/**
 * Handle package_batch: execute a batch of package operations sequentially.
 */
async function handlePackageBatch(
  requestId: string,
  operations: readonly PackageBatchOperation[],
  state: ServerState,
  emitProgress: ProgressEmitter,
): Promise<ServerMessage> {
  if (!state.scanResult) {
    return createError(requestId, 'No scan data available', 'Run a scan_project request first');
  }

  // Pre-validate all package names before starting the batch
  for (const op of operations) {
    if (!isReasonablePackageName(op.packageName)) {
      return createError(
        requestId,
        `Invalid package name in batch: "${op.packageName}"`,
        'Package names may only contain alphanumeric characters, dots, hyphens, underscores, slashes, @, and colons',
      );
    }
  }

  const pmDeps = { executorRegistry: state.executorRegistry, projectRoot: state.projectRoot };

  const batchResult = await executeBatch(
    pmDeps,
    operations,
    {
      findModule: (modulePath) =>
        state.scanResult?.project.modules.find((m) => m.path === modulePath),
      moduleActionLocks: state.moduleActionLocks,
      postActionScan: async (module) => {
        const event = buildModuleChangeEvent(module);
        const freshScan = await incrementalScan({
          projectRoot: state.projectRoot,
          previousResult: state.scanResult!,
          event,
        });
        state.scanResult = freshScan;
      },
    },
    emitProgress,
    requestId,
  );

  emitProgress(
    requestId,
    batchResult.stoppedEarly
      ? `Batch stopped early: ${batchResult.completedCount}/${batchResult.totalCount} completed`
      : `Batch complete: ${batchResult.completedCount} operations`,
    2,
  );

  const response: PackageBatchResultMessage = {
    type: 'package_batch_result',
    requestId,
    results: batchResult.results,
    completedCount: batchResult.completedCount,
    totalCount: batchResult.totalCount,
    stoppedEarly: batchResult.stoppedEarly,
  };

  return response;
}

/**
 * Build a FileChangeEvent for incremental re-scan after a package action.
 * Targets only the affected module's manifests.
 */
function buildModuleChangeEvent(module: { readonly path: string; readonly manifests: readonly string[] }): FileChangeEvent {
  return {
    changedFiles: module.manifests.map((m) => `${module.path}/${m}`),
    addedFiles: [],
    removedFiles: [],
    affectedModules: [module.path],
  };
}

/**
 * Create an ErrorMessage with the standard format.
 */
function createError(
  requestId: string,
  message: string,
  suggestion: string,
): ErrorMessage {
  return {
    type: 'error',
    requestId,
    message,
    suggestion,
  };
}
