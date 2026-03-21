/**
 * Typed, reconnecting WebSocket client with Zod validation.
 *
 * Incoming messages are validated with serverMessageSchema.
 * Reconnects with exponential backoff (1s → 30s max).
 * On reconnect, sends a `sync` message.
 */

import type { ClientMessage, ServerMessage } from '@deckgraph/shared';
import { serverMessageSchema } from '@deckgraph/shared';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface WsClientOptions {
  /** WebSocket URL (e.g. ws://127.0.0.1:3333) */
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

const MIN_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
const BACKOFF_MULTIPLIER = 2;

/**
 * Get the WebSocket URL from env or derive from current page.
 */
export function getWsUrl(): string {
  // Vite env var for dev mode
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL as string;
  }

  // Derive from current page location
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }

  return 'ws://127.0.0.1:3333';
}

/**
 * Generate a unique request ID.
 */
export function createRequestId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Create a typed, reconnecting WebSocket client.
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
    if (ws) {
      ws.onopen = null;
      ws.onclose = null;
      ws.onmessage = null;
      ws.onerror = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }

    setStatus('connecting');

    ws = new WebSocket(url);

    ws.onopen = () => {
      const isReconnect = reconnectAttempts > 0;
      reconnectAttempts = 0;
      setStatus('connected');

      // On reconnect, request current state
      if (isReconnect) {
        send({ type: 'sync', requestId: createRequestId() });
      }
    };

    ws.onclose = () => {
      ws = null;
      if (!intentionalClose) {
        scheduleReconnect();
      } else {
        setStatus('disconnected');
      }
    };

    ws.onerror = () => {
      // onclose will fire after this — reconnect handled there
    };

    ws.onmessage = (event: MessageEvent) => {
      const raw = typeof event.data === 'string' ? event.data : String(event.data);

      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch {
        onValidationError?.(new Error('Invalid JSON from server'), raw);
        return;
      }

      const result = serverMessageSchema.safeParse(json);
      if (result.success) {
        onMessage(result.data as ServerMessage);
      } else {
        onValidationError?.(result.error, raw);
      }
    };
  }

  // H4: Returns boolean indicating whether the message was sent
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
      if (ws) {
        ws.close();
        ws = null;
      }
      setStatus('disconnected');
    },

    send,

    getStatus() {
      return status;
    },
  };
}
