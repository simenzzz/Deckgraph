/**
 * Internal types for the WebSocket layer.
 *
 * These are backend-only types — not shared with the UI.
 */

import type WebSocket from 'ws';
import type { AdapterRegistry, ImportPackageMap } from '@deckgraph/shared';
import type { ExecutorRegistry } from '../actions/types.js';
import type { ScanResult } from '../scanner/scanner.js';
import type { WorkspaceScanResult } from '../scanner/workspaceScanner.js';
import type { WorkspaceConfig } from '@deckgraph/shared';
import type { RegistryCache } from '../adapters/registryCache.js';
import type { RegistryRateLimiter } from '../adapters/registryRateLimiter.js';
import type { FileWatcher } from '../watcher/fileWatcher.js';

/**
 * Mutable server state container.
 * Shared across all connections and handlers.
 */
export interface ServerState {
  scanResult: ScanResult | null;
  readonly projectRoot: string;
  isScanning: boolean;
  /** File watcher for incremental re-scanning (null if --no-watch) */
  fileWatcher: FileWatcher | null;
  /** File watchers for workspace mode - one per root (Map of root path → watcher) */
  fileWatchers: Map<string, FileWatcher>;
  /** Workspace-level scan result (null in single-project mode) */
  workspaceScanResult: WorkspaceScanResult | null;
  /** Workspace-level config (null in single-project mode) */
  workspaceConfig: WorkspaceConfig | null;
  /** Adapter registry for import analysis and registry queries */
  readonly registry: AdapterRegistry;
  /** Import package map for resolving import→package name mismatches */
  readonly packageMap: ImportPackageMap;
  /** LRU cache for registry metadata (shared across all adapters) */
  readonly registryCache: RegistryCache;
  /** Rate limiter for registry API calls */
  readonly rateLimiter: RegistryRateLimiter;
  /** Executor registry for package management actions */
  readonly executorRegistry: ExecutorRegistry;
  /** Per-module locks preventing concurrent package operations (modulePath → requestId) */
  moduleActionLocks: Map<string, string>;
}

/**
 * Wraps a raw WebSocket with a client identifier for logging.
 */
export interface ClientConnection {
  readonly ws: WebSocket;
  readonly clientId: string;
}

/**
 * Callback to emit progress messages to a specific client.
 * Best-effort: drops messages if the socket is not open.
 */
export type ProgressEmitter = (
  requestId: string,
  message: string,
  phase: 0 | 1 | 2 | 3,
) => void;
