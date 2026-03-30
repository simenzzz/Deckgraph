/**
 * Node.js WebSocket client for communicating with the Deckgraph backend.
 *
 * Mirrors the WsClient interface from packages/ui/src/lib/wsClient.ts,
 * but uses the `ws` package instead of the browser WebSocket API.
 * Incoming messages are validated with serverMessageSchema from @deckgraph/shared.
 */

import WebSocket from 'ws';
import { serverMessageSchema } from '@deckgraph/shared';
import type { ClientMessage, ServerMessage } from '@deckgraph/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface WsClientOptions {
  /** WebSocket URL (e.g. ws://127.0.0.1:3334) */
  readonly url: string;
  /** Called when a validated server message arrives */
  readonly onMessage: (message: ServerMessage) => void;
  /** Called when connection status changes */
  readonly onStatusChange: (status: ConnectionStatus) => void;
  /** Called when a message fails validation */
  readonly onValidationError?: (error: unknown, raw: string) => void;
}

export interface WsClient {
  /** Open the WebSocket connection */
  connect(): void;
  /** Close the connection and stop reconnecting */
  disconnect(): void;
  /** Send a typed client message. Returns true if the message was sent. */
  send(message: ClientMessage): boolean;
  /** Current connection status */
  getStatus(): ConnectionStatus;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
const BACKOFF_MULTIPLIER = 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a unique request ID. */
function createRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a typed, reconnecting WebSocket client backed by the `ws` package.
 */
export function createWsClient(options: WsClientOptions): WsClient {
  const { url, onMessage, onStatusChange, onValidationError } = options;

  let ws: WebSocket | null = null;
  let status: ConnectionStatus = 'disconnected';
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let intentionalClose = false;

  function setStatus(newStatus: ConnectionStatus): void {
    if (status !== newStatus) {
      status = newStatus;
      onStatusChange(newStatus);
    }
  }

  function getBackoffMs(): number {
    const backoff = MIN_BACKOFF_MS * Math.pow(BACKOFF_MULTIPLIER, reconnectAttempts);
    return Math.min(backoff, MAX_BACKOFF_MS);
  }

  function scheduleReconnect(): void {
    if (intentionalClose) return;

    setStatus('reconnecting');
    const delay = getBackoffMs();
    reconnectAttempts++;

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      doConnect();
    }, delay);
  }

  function doConnect(): void {
    cleanupSocket();

    setStatus('connecting');

    ws = new WebSocket(url);

    ws.on('open', () => {
      const isReconnect = reconnectAttempts > 0;
      reconnectAttempts = 0;
      setStatus('connected');

      // On reconnect, request current state
      if (isReconnect) {
        send({ type: 'sync', requestId: createRequestId() });
      }
    });

    ws.on('close', () => {
      ws = null;
      if (!intentionalClose) {
        scheduleReconnect();
      } else {
        setStatus('disconnected');
      }
    });

    ws.on('error', () => {
      // onclose will fire after this — reconnect handled there
    });

    ws.on('message', (raw: WebSocket.Data) => {
      const text = typeof raw === 'string' ? raw : String(raw);

      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        onValidationError?.(new Error('Invalid JSON from server'), text);
        return;
      }

      const result = serverMessageSchema.safeParse(json);
      if (result.success) {
        onMessage(result.data as ServerMessage);
      } else {
        onValidationError?.(result.error, text);
      }
    });
  }

  function cleanupSocket(): void {
    if (ws) {
      ws.removeAllListeners();
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      ws = null;
    }
  }

  function send(message: ClientMessage): boolean {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  return {
    connect() {
      intentionalClose = false;
      reconnectAttempts = 0;
      doConnect();
    },

    disconnect() {
      intentionalClose = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      cleanupSocket();
      setStatus('disconnected');
    },

    send,

    getStatus(): ConnectionStatus {
      return status;
    },
  };
}
