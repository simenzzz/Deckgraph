/**
 * WebSocket server lifecycle management.
 *
 * Creates a localhost-only WebSocket server that accepts client connections,
 * routes messages through the protocol handler, and supports graceful shutdown.
 */

import { WebSocketServer } from 'ws';
import type WebSocket from 'ws';
import type { ServerMessage } from '@deckgraph/shared';
import { createLogger } from '../logger.js';
import { createProgressEmitter } from './progress.js';
import { handleMessage } from './protocol.js';
import type { ClientConnection, ServerState } from './types.js';

const logger = createLogger('server');

/**
 * Options for creating a Deckgraph WebSocket server.
 */
export interface ServerOptions {
  /** Port to bind to (default: 3333) */
  readonly port?: number;
  /** Host to bind to (default: '127.0.0.1') */
  readonly host?: string;
  /** Absolute path to the project root */
  readonly projectRoot: string;
}

/**
 * Public interface for controlling the Deckgraph server.
 */
export interface DeckgraphServer {
  /** Start listening for connections */
  start(): Promise<void>;
  /** Gracefully stop the server and close all clients */
  stop(): Promise<void>;
  /** Send a message to all connected clients */
  broadcast(message: ServerMessage): void;
  /** Number of currently connected clients */
  getClientCount(): number;
  /** Current server state */
  getState(): ServerState;
}

/**
 * Create a new Deckgraph WebSocket server.
 */
export function createServer(options: ServerOptions): DeckgraphServer {
  const port = options.port ?? 3333;
  const host = options.host ?? '127.0.0.1';

  const state: ServerState = {
    scanResult: null,
    projectRoot: options.projectRoot,
    isScanning: false,
  };

  const clients = new Set<ClientConnection>();
  let clientCounter = 0;
  let wss: WebSocketServer | null = null;

  function onConnection(ws: WebSocket): void {
    clientCounter++;
    const clientId = `client-${clientCounter}`;
    const connection: ClientConnection = { ws, clientId };

    clients.add(connection);
    logger.info({ clientId }, 'Client connected');

    const emitProgress = createProgressEmitter(ws, logger);

    ws.on('message', (data: Buffer | string) => {
      const raw = typeof data === 'string' ? data : data.toString('utf-8');

      handleMessage(raw, connection, state, emitProgress)
        .then((response) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify(response));
          }
        })
        .catch((error) => {
          const detail = error instanceof Error ? error.message : 'unknown error';
          logger.error({ clientId, error: detail }, 'Unhandled message error');
        });
    });

    ws.on('close', () => {
      clients.delete(connection);
      logger.info({ clientId }, 'Client disconnected');
    });

    ws.on('error', (error) => {
      clients.delete(connection);
      logger.error(
        { clientId, error: error.message },
        'Client connection error',
      );
    });
  }

  return {
    start(): Promise<void> {
      return new Promise((resolve, reject) => {
        wss = new WebSocketServer({ port, host });

        wss.on('connection', onConnection);

        wss.on('listening', () => {
          logger.info({ host, port }, 'Server listening');
          resolve();
        });

        wss.on('error', (error) => {
          logger.error({ error: error.message }, 'Server error');
          reject(error);
        });
      });
    },

    stop(): Promise<void> {
      return new Promise((resolve) => {
        if (!wss) {
          resolve();
          return;
        }

        for (const client of clients) {
          client.ws.close(1001, 'Server shutting down');
        }
        clients.clear();

        wss.close(() => {
          logger.info('Server stopped');
          wss = null;
          resolve();
        });
      });
    },

    broadcast(message: ServerMessage): void {
      const payload = JSON.stringify(message);
      for (const client of clients) {
        if (client.ws.readyState === client.ws.OPEN) {
          client.ws.send(payload);
        }
      }
    },

    getClientCount(): number {
      return clients.size;
    },

    getState(): ServerState {
      return state;
    },
  };
}
