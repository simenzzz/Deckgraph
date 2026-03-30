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
  NotificationMessage,
  ProjectOverviewMessage,
  WorkspaceOverviewMessage,
  ViewResultMessage,
  ModuleUpdatedMessage,
  DependencyEnrichedMessage,
  PackageActionResultMessage,
  PackageBatchResultMessage,
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
import { scanWorkspace } from '../scanner/workspaceScanner.js';
import { incrementalScan } from '../scanner/incrementalScanner.js';
import type { FileChangeEvent } from '../watcher/fileWatcher.js';
import { executeQuery } from '../graph/queryEngine.js';
import { resolveImports } from '../analysis/importResolver.js';
import { addModule } from '../graph/dependencyGraph.js';
import { loadWorkspaceConfig } from '../config/configLoader.js';
import { discoverRoots } from '../discovery/workspaceDiscovery.js';
import { runHooksForEvent } from '../hooks/notifier.js';
import { createLogger } from '../logger.js';
import { ErrorCatalog, createCatalogError, mapError } from '../errors/index.js';
import type { ClientConnection, ProgressEmitter, ServerState } from './types.js';

const logger = createLogger('protocol');

const VALID_TYPES = [
  'scan_project',
  'scan_workspace',
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
  broadcast?: (message: ServerMessage) => void,
): Promise<ServerMessage> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    logger.warn({ clientId: connection.clientId }, 'Received invalid JSON');
    return createCatalogError(ErrorCatalog.INVALID_JSON, 'unknown');
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
      return createCatalogError(ErrorCatalog.VALIDATION_FAILED, 'unknown', `Valid message types: ${VALID_TYPES.join(', ')}`);
    }
    throw error;
  }

  return dispatch(parsed, state, emitProgress, broadcast);
}

/**
 * Dispatch a validated client message to its handler.
 * Exhaustive switch with TypeScript never check.
 */
async function dispatch(
  message: ClientMessage,
  state: ServerState,
  emitProgress: ProgressEmitter,
  broadcast?: (message: ServerMessage) => void,
): Promise<ServerMessage> {
  try {
    switch (message.type) {
      case 'scan_project':
        return await handleScanProject(message.requestId, state, emitProgress);

      case 'scan_workspace':
        return await handleScanWorkspace(
          message.requestId,
          state,
          emitProgress,
          broadcast,
        );

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
    const entry = mapError(error);
    return createCatalogError(entry, message.requestId);
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
    return createCatalogError(ErrorCatalog.SCAN_ALREADY_RUNNING, requestId);
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
 * Handle scan_workspace: load workspace config, scan all roots, return workspace overview.
 */
async function handleScanWorkspace(
  requestId: string,
  state: ServerState,
  emitProgress: ProgressEmitter,
  broadcast?: (message: ServerMessage) => void,
): Promise<ServerMessage> {
  if (state.isScanning) {
    return createCatalogError(ErrorCatalog.SCAN_ALREADY_RUNNING, requestId);
  }

  state.isScanning = true;

  try {
    emitProgress(requestId, 'Loading workspace configuration...', 0);

    const workspaceConfig = await loadWorkspaceConfig(state.projectRoot);

    if (!workspaceConfig) {
      return createCatalogError(ErrorCatalog.NO_WORKSPACE_CONFIG, requestId);
    }

    state.workspaceConfig = workspaceConfig;

    emitProgress(requestId, 'Discovering workspace roots...', 0);

    const roots = await discoverRoots(state.projectRoot, workspaceConfig);

    emitProgress(requestId, `Scanning ${roots.length} workspace roots...`, 0);

    // Create broadcast function for hooks (narrowed to NotificationMessage)
    const broadcastFn: (msg: NotificationMessage) => void = broadcast
      ? (msg: NotificationMessage) => broadcast(msg)
      : () => {
          // No-op if no broadcast function available
        };

    const result = await scanWorkspace({
      roots,
      config: workspaceConfig,
    });

    state.workspaceScanResult = result;

    // Store first project's scan result for backward compatibility
    const firstResult = result.projectResults.values().next().value;
    if (firstResult) {
      state.scanResult = firstResult;
    }

    emitProgress(requestId, 'Workspace scan complete', 1);

    // Trigger on-scan-complete hooks
    const totalModules = result.workspace.projects.reduce(
      (sum, p) => sum + p.modules.length,
      0,
    );
    const totalDeps = result.workspace.projects.reduce(
      (sum, p) => sum + p.modules.reduce((s, m) => s + m.dependencies.length, 0),
      0,
    );

    // Fire hooks in background (don't block the scan response)
    runHooksForEvent(
      workspaceConfig.hooks,
      'on-scan-complete',
      {
        event: 'on-scan-complete',
        projectRoot: state.projectRoot,
        data: {
          type: 'scan-complete',
          moduleCount: totalModules,
          depCount: totalDeps,
        },
      },
      broadcastFn,
    ).catch((error) => {
      const detail = error instanceof Error ? error.message : 'unknown';
      logger.error({ error: detail }, 'Hook execution failed');
    });

    const overview: WorkspaceOverviewMessage = {
      type: 'workspace_overview',
      requestId,
      data: result.workspace,
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
    return createCatalogError(ErrorCatalog.NO_SCAN_DATA, requestId);
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
    return createCatalogError(ErrorCatalog.NO_SCAN_DATA, requestId);
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
    return createCatalogError(ErrorCatalog.NO_SCAN_DATA, requestId);
  }

  const module = state.scanResult.project.modules.find(
    (m) => m.path === modulePath,
  );

  if (!module) {
    return createCatalogError(ErrorCatalog.MODULE_NOT_FOUND, requestId, modulePath);
  }

  if (module.analysisState !== 'manifest-only') {
    return createCatalogError(ErrorCatalog.MODULE_ALREADY_ANALYZED, requestId, modulePath);
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

  // TODO: Detect unused dependencies and trigger on-unused hooks
  // This would require analyzing which deps are not referenced in any import
  // For now, placeholder: unusedDeps = []
  // await _maybeTriggerHooks(state, undefined, 'on-unused', unusedDeps);

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
    return createCatalogError(ErrorCatalog.NO_SCAN_DATA, requestId);
  }

  if (!isReasonablePackageName(packageName)) {
    return createCatalogError(ErrorCatalog.INVALID_PACKAGE_NAME, requestId, packageName);
  }

  const adapter = state.registry.getAdapterForEcosystem(ecosystem);
  if (!adapter) {
    return createCatalogError(ErrorCatalog.NO_ADAPTER, requestId, ecosystem);
  }

  emitProgress(requestId, `Querying ${ecosystem} registry for ${packageName}...`, 0);

  const registryMeta = await adapter.queryRegistry(packageName);

  if (!registryMeta) {
    return createCatalogError(ErrorCatalog.PACKAGE_NOT_FOUND, requestId, packageName);
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

  // TODO: Detect outdated packages and trigger on-outdated hooks
  // This would require comparing current version with registryMeta.latestVersion
  // For now, placeholder: outdatedDeps = []
  // await _maybeTriggerHooks(state, undefined, 'on-outdated', outdatedDeps);

  // TODO: Detect license violations and trigger on-license-violation hooks
  // This would require checking licenses against a policy
  // For now, placeholder: violatingDeps = []
  // await _maybeTriggerHooks(state, undefined, 'on-license-violation', violatingDeps);

  if (!enrichedDep) {
    return createCatalogError(ErrorCatalog.DEPENDENCY_NOT_IN_PROJECT, requestId, packageName);
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
    return createCatalogError(ErrorCatalog.NO_SCAN_DATA, requestId);
  }

  const module = state.scanResult.project.modules.find((m) => m.path === modulePath);
  if (!module) {
    return createCatalogError(ErrorCatalog.MODULE_NOT_FOUND, requestId, modulePath);
  }

  // Check per-module lock
  const existingLock = state.moduleActionLocks.get(modulePath);
  if (existingLock) {
    return createCatalogError(ErrorCatalog.OPERATION_IN_PROGRESS, requestId, module.name);
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
    return createCatalogError(ErrorCatalog.NO_SCAN_DATA, requestId);
  }

  const module = state.scanResult.project.modules.find((m) => m.path === modulePath);
  if (!module) {
    return createCatalogError(ErrorCatalog.MODULE_NOT_FOUND, requestId, modulePath);
  }

  const existingLock = state.moduleActionLocks.get(modulePath);
  if (existingLock) {
    return createCatalogError(ErrorCatalog.OPERATION_IN_PROGRESS, requestId, module.name);
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
    return createCatalogError(ErrorCatalog.NO_SCAN_DATA, requestId);
  }

  const module = state.scanResult.project.modules.find((m) => m.path === modulePath);
  if (!module) {
    return createCatalogError(ErrorCatalog.MODULE_NOT_FOUND, requestId, modulePath);
  }

  const existingLock = state.moduleActionLocks.get(modulePath);
  if (existingLock) {
    return createCatalogError(ErrorCatalog.OPERATION_IN_PROGRESS, requestId, module.name);
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
    return createCatalogError(ErrorCatalog.NO_SCAN_DATA, requestId);
  }

  // Pre-validate all package names before starting the batch
  for (const op of operations) {
    if (!isReasonablePackageName(op.packageName)) {
      return createCatalogError(ErrorCatalog.INVALID_PACKAGE_NAME, requestId, op.packageName);
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

