/**
 * WebSocket message types for client-server communication.
 *
 * These discriminated unions define the protocol between the React UI
 * and the Node.js backend over WebSocket.
 */

import type { Dependency, Ecosystem, Module, Project } from './project.js';
import type { ViewQuery, ViewResult } from './views.js';

// ============================================================================
// Client Messages (UI → Backend)
// ============================================================================

/**
 * Discriminated union of all client message types.
 */
export type ClientMessage =
  | ScanProjectMessage
  | ViewQueryMessage
  | AnalyzeImportsMessage
  | EnrichDependencyMessage
  | SyncMessage;

/**
 * Request a full project scan.
 */
export interface ScanProjectMessage {
  readonly type: 'scan_project';
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

// ============================================================================
// Server Messages (Backend → UI)
// ============================================================================

/**
 * Discriminated union of all server message types.
 */
export type ServerMessage =
  | ProjectOverviewMessage
  | ViewResultMessage
  | ModuleUpdatedMessage
  | DependencyEnrichedMessage
  | ProgressMessage
  | ErrorMessage;

/**
 * Full project overview after scan completion.
 */
export interface ProjectOverviewMessage {
  readonly type: 'project_overview';
  readonly requestId: string;
  readonly data: Project;
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
