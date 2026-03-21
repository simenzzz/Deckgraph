/**
 * Internal types for the WebSocket layer.
 *
 * These are backend-only types — not shared with the UI.
 */

import type WebSocket from 'ws';
import type { ScanResult } from '../scanner/scanner.js';

/**
 * Mutable server state container.
 * Shared across all connections and handlers.
 */
export interface ServerState {
  scanResult: ScanResult | null;
  readonly projectRoot: string;
  isScanning: boolean;
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
