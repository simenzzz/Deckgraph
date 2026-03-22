/**
 * Internal types for the WebSocket layer.
 *
 * These are backend-only types — not shared with the UI.
 */

import type WebSocket from 'ws';
import type { AdapterRegistry, ImportPackageMap } from '@deckgraph/shared';
import type { ScanResult } from '../scanner/scanner.js';
import type { RegistryCache } from '../adapters/registryCache.js';
import type { RegistryRateLimiter } from '../adapters/registryRateLimiter.js';

/**
 * Mutable server state container.
 * Shared across all connections and handlers.
 */
export interface ServerState {
  scanResult: ScanResult | null;
  readonly projectRoot: string;
  isScanning: boolean;
  /** Adapter registry for import analysis and registry queries */
  readonly registry: AdapterRegistry;
  /** Import package map for resolving import→package name mismatches */
  readonly packageMap: ImportPackageMap;
  /** LRU cache for registry metadata (shared across all adapters) */
  readonly registryCache: RegistryCache;
  /** Rate limiter for registry API calls */
  readonly rateLimiter: RegistryRateLimiter;
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
