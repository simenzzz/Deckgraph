/**
 * WebSocket message types for client-server communication.
 *
 * These discriminated unions define the protocol between the React UI
 * and the Node.js backend over WebSocket.
 */

import type { PackageActionResult, PackageBatchOperation } from './actions.js';
import type { DemoRepository, Dependency, DependencyScope, Ecosystem, Module, Project, Workspace } from './project.js';
import type { ViewQuery, ViewResult } from './views.js';

// ============================================================================
// Client Messages (UI → Backend)
// ============================================================================

/**
 * Discriminated union of all client message types.
 */
export type ClientMessage =
  | ScanProjectMessage
  | ImportDemoRepoMessage
  | ImportPublicGithubRepoMessage
  | ScanWorkspaceMessage
  | ViewQueryMessage
  | AnalyzeImportsMessage
  | EnrichDependencyMessage
  | SyncMessage
  | PackageUpdateMessage
  | PackageInstallMessage
  | PackageRemoveMessage
  | PackageBatchMessage;

/**
 * Request a full project scan.
 */
export interface ScanProjectMessage {
  readonly type: 'scan_project';
  readonly requestId: string;
}

/**
 * Import and scan a curated repository in hosted demo mode.
 */
export interface ImportDemoRepoMessage {
  readonly type: 'import_demo_repo';
  readonly requestId: string;
  readonly repoId: string;
  /** Repository-relative directory to scan. Defaults to repository root. */
  readonly scanRoot?: string;
  /** Repository-relative directories/globs to exclude from scan discovery. */
  readonly excludePaths?: readonly string[];
}

/**
 * Import and scan a public GitHub repository in hosted demo mode.
 */
export interface ImportPublicGithubRepoMessage {
  readonly type: 'import_public_github_repo';
  readonly requestId: string;
  readonly url: string;
  /** Repository-relative directory to scan. Defaults to repository root. */
  readonly scanRoot?: string;
  /** Repository-relative directories/globs to exclude from scan discovery. */
  readonly excludePaths?: readonly string[];
}

/**
 * Request a workspace scan (polyrepo mode).
 */
export interface ScanWorkspaceMessage {
  readonly type: 'scan_workspace';
  readonly requestId: string;
}

/**
 * Query for a filtered view of dependencies.
 */
export interface ViewQueryMessage {
  readonly type: 'view_query';
  readonly requestId: string;
  readonly query: ViewQuery;
}

/**
 * Request import analysis for a specific module.
 */
export interface AnalyzeImportsMessage {
  readonly type: 'analyze_imports';
  readonly requestId: string;
  readonly modulePath: string;
}

/**
 * Request registry enrichment for a specific dependency.
 */
export interface EnrichDependencyMessage {
  readonly type: 'enrich_dependency';
  readonly requestId: string;
  readonly ecosystem: Ecosystem;
  readonly packageName: string;
}

/**
 * Sync request to check backend health.
 */
export interface SyncMessage {
  readonly type: 'sync';
  readonly requestId: string;
}

/**
 * Request to update a dependency to a specific version.
 */
export interface PackageUpdateMessage {
  readonly type: 'package_update';
  readonly requestId: string;
  readonly ecosystem: Ecosystem;
  readonly packageName: string;
  readonly modulePath: string;
  readonly targetVersion: string;
}

/**
 * Request to install a new dependency.
 */
export interface PackageInstallMessage {
  readonly type: 'package_install';
  readonly requestId: string;
  readonly ecosystem: Ecosystem;
  readonly packageName: string;
  readonly modulePath: string;
  /** null = latest version */
  readonly version: string | null;
  readonly scope: DependencyScope;
}

/**
 * Request to remove a dependency.
 */
export interface PackageRemoveMessage {
  readonly type: 'package_remove';
  readonly requestId: string;
  readonly ecosystem: Ecosystem;
  readonly packageName: string;
  readonly modulePath: string;
}

/**
 * Request to execute multiple package operations as a batch.
 */
export interface PackageBatchMessage {
  readonly type: 'package_batch';
  readonly requestId: string;
  readonly operations: readonly PackageBatchOperation[];
}

// ============================================================================
// Server Messages (Backend → UI)
// ============================================================================

/**
 * Discriminated union of all server message types.
 */
export type ServerMessage =
  | ProjectOverviewMessage
  | DemoRepositoryImportedMessage
  | WorkspaceOverviewMessage
  | ViewResultMessage
  | ModuleUpdatedMessage
  | DependencyEnrichedMessage
  | ProgressMessage
  | ErrorMessage
  | NotificationMessage
  | FileChangeDetectedMessage
  | PackageActionResultMessage
  | PackageBatchResultMessage
  | ReadyMessage;

/**
 * Full project overview after scan completion.
 */
export interface ProjectOverviewMessage {
  readonly type: 'project_overview';
  readonly requestId: string;
  readonly data: Project;
}

/**
 * Public demo repository imported and scanned for this browser session.
 */
export interface DemoRepositoryImportedMessage {
  readonly type: 'demo_repository_imported';
  readonly requestId: string;
  readonly repository: DemoRepository;
  readonly data: Project;
}

/**
 * Workspace overview after workspace scan completion (polyrepo mode).
 */
export interface WorkspaceOverviewMessage {
  readonly type: 'workspace_overview';
  readonly requestId: string;
  readonly data: Workspace;
}

/**
 * Filtered view result in response to ViewQueryMessage.
 */
export interface ViewResultMessage {
  readonly type: 'view_result';
  readonly requestId: string;
  readonly data: ViewResult;
}

/**
 * Module update after import analysis or registry enrichment.
 */
export interface ModuleUpdatedMessage {
  readonly type: 'module_updated';
  readonly requestId: string;
  readonly module: Module;
}

/**
 * Dependency enrichment result from registry query.
 */
export interface DependencyEnrichedMessage {
  readonly type: 'dependency_enriched';
  readonly requestId: string;
  readonly dependency: Dependency;
}

/**
 * Progress update during long-running operations.
 */
export interface ProgressMessage {
  readonly type: 'progress';
  readonly requestId: string;
  readonly message: string;
  readonly phase: 0 | 1 | 2 | 3;
}

/**
 * Error response with user-friendly message and suggestion.
 */
export interface ErrorMessage {
  readonly type: 'error';
  readonly requestId: string;
  readonly message: string;
  readonly suggestion: string;
}

/**
 * Notification message from developer hooks or system events.
 */
export interface NotificationMessage {
  readonly type: 'notification';
  readonly requestId: string;
  readonly severity: 'info' | 'warning' | 'error';
  readonly title: string;
  readonly body: string;
  readonly timestamp: string;
}

/**
 * Server-initiated notification that files have changed on disk.
 * Sent before the incremental re-scan begins.
 */
export interface FileChangeDetectedMessage {
  readonly type: 'file_change_detected';
  readonly requestId: string;
  readonly affectedModules: readonly string[];
  readonly timestamp: string;
}

/**
 * Result of a single package management action (update/install/remove).
 */
export interface PackageActionResultMessage {
  readonly type: 'package_action_result';
  readonly requestId: string;
  readonly result: PackageActionResult;
}

/**
 * Result of a batch package management operation.
 */
export interface PackageBatchResultMessage {
  readonly type: 'package_batch_result';
  readonly requestId: string;
  readonly results: readonly PackageActionResult[];
  readonly completedCount: number;
  readonly totalCount: number;
  /** true if execution stopped early due to a per-module failure */
  readonly stoppedEarly: boolean;
}

/**
 * Initial handshake message sent when a client connects.
 * Informs the client whether a config file exists and whether scan data is available.
 */
export interface ReadyMessage {
  readonly type: 'ready';
  readonly requestId: string;
  readonly configPresent: boolean;
  readonly hasScannedData: boolean;
  readonly demoMode: boolean;
  readonly demoRepositories: readonly DemoRepository[];
}
