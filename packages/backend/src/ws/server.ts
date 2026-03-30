/**
 * WebSocket server lifecycle management.
 *
 * Creates a localhost-only HTTP server that serves UI assets and upgrades
 * WebSocket connections. Routes messages through the protocol handler
 * and supports graceful shutdown.
 */

import { createServer as createHttpServer } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import { WebSocketServer } from 'ws';
import type WebSocket from 'ws';
import { randomUUID } from 'node:crypto';
import type { ServerMessage, FileChangeDetectedMessage, ProjectOverviewMessage, ReadyMessage } from '@deckgraph/shared';
import { createLogger } from '../logger.js';
import { createExecutorRegistry } from '../actions/executors/index.js';
import { createDefaultRegistry } from '../adapters/index.js';
import { createImportPackageMap } from '../adapters/importPackageMap.js';
import { createRegistryCache } from '../adapters/registryCache.js';
import { createRegistryRateLimiter } from '../adapters/registryRateLimiter.js';
import { createFileWatcher } from '../watcher/fileWatcher.js';
import type { FileChangeEvent } from '../watcher/fileWatcher.js';
import { incrementalScan } from '../scanner/incrementalScanner.js';
import { loadConfig } from '../config/configLoader.js';
import { createProgressEmitter } from './progress.js';
import { handleMessage } from './protocol.js';
import { createStaticHandler } from './staticServer.js';
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
  /** Absolute path to the UI dist directory (optional) */
  readonly uiDistPath?: string;
  /** Disable file watching (default: false) */
  readonly noWatch?: boolean;
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
 *
 * Uses an HTTP server that:
 * - Serves static UI assets from uiDistPath (if provided and exists)
 * - Upgrades WebSocket connections on the same port
 */
export function createServer(options: ServerOptions): DeckgraphServer {
  const port = options.port ?? 3333;
  const host = options.host ?? '127.0.0.1';

  const registryCache = createRegistryCache();
  const rateLimiter = createRegistryRateLimiter();

  const state: ServerState = {
    scanResult: null,
    projectRoot: options.projectRoot,
    isScanning: false,
    fileWatcher: null,
    fileWatchers: new Map(),
    workspaceScanResult: null,
    workspaceConfig: null,
    registry: createDefaultRegistry(registryCache, rateLimiter),
    packageMap: createImportPackageMap(),
    registryCache,
    rateLimiter,
    executorRegistry: createExecutorRegistry(),
    moduleActionLocks: new Map(),
  };

  const clients = new Set<ClientConnection>();
  let clientCounter = 0;
  let httpServer: HttpServer | null = null;
  let wss: WebSocketServer | null = null;

  function broadcastMessage(message: ServerMessage): void {
    const payload = JSON.stringify(message);
    for (const client of clients) {
      if (client.ws.readyState === client.ws.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  function onFileChanges(event: FileChangeEvent): void {
    if (!state.scanResult || state.isScanning) return;

    const changeMsg: FileChangeDetectedMessage = {
      type: 'file_change_detected',
      requestId: randomUUID(),
      affectedModules: [...event.affectedModules],
      timestamp: new Date().toISOString(),
    };
    broadcastMessage(changeMsg);

    state.isScanning = true;

    incrementalScan({
      projectRoot: state.projectRoot,
      previousResult: state.scanResult,
      event,
      registry: state.registry,
    })
      .then((newResult) => {
        state.scanResult = newResult;

        if (state.fileWatcher) {
          state.fileWatcher.setModules(newResult.project.modules);
        }

        const overview: ProjectOverviewMessage = {
          type: 'project_overview',
          requestId: changeMsg.requestId,
          data: newResult.project,
        };
        broadcastMessage(overview);
      })
      .catch((error) => {
        const detail = error instanceof Error ? error.message : 'unknown error';
        logger.error({ error: detail }, 'Incremental scan failed');
      })
      .finally(() => {
        state.isScanning = false;
      });
  }

  function onConnection(ws: WebSocket): void {
    clientCounter++;
    const clientId = `client-${clientCounter}`;
    const connection: ClientConnection = { ws, clientId };

    clients.add(connection);
    logger.info({ clientId }, 'Client connected');

    // Send ready message with project state
    void (async () => {
      try {
        let configPresent = false;
        try {
          configPresent = (await loadConfig(state.projectRoot)) !== null;
        } catch {
          // Config file doesn't exist or is invalid — treat as absent
          configPresent = false;
        }
        const ready: ReadyMessage = {
          type: 'ready',
          requestId: randomUUID(),
          configPresent,
          hasScannedData: state.scanResult !== null,
        };
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify(ready));
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'unknown';
        logger.error({ clientId, error: detail }, 'Failed to send ready message');
      }
    })();

    const emitProgress = createProgressEmitter(ws, logger);

    ws.on('message', (data: Buffer | string) => {
      const raw = typeof data === 'string' ? data : data.toString('utf-8');

      handleMessage(raw, connection, state, emitProgress, broadcastMessage)
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
        // Build the static file handler (null if distPath missing)
        const staticHandler = options.uiDistPath
          ? createStaticHandler(options.uiDistPath)
          : null;

        httpServer = createHttpServer((req, res) => {
          if (staticHandler) {
            staticHandler(req, res);
          } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('UI not built. Run: pnpm --filter @deckgraph/ui build');
          }
        });

        wss = new WebSocketServer({ server: httpServer });
        wss.on('connection', onConnection);

        wss.on('error', (error) => {
          logger.error({ error: error.message }, 'WebSocket server error');
        });

        httpServer.on('error', (error) => {
          logger.error({ error: error.message }, 'HTTP server error');
          reject(error);
        });

        httpServer.listen(port, host, () => {
          logger.info({ host, port }, 'Server listening');

          if (!options.noWatch) {
            const watcher = createFileWatcher({
              projectRoot: options.projectRoot,
              modules: state.scanResult?.project.modules ?? [],
            });
            watcher.onChanges(onFileChanges);
            state.fileWatcher = watcher;
            watcher.start().catch((error) => {
              const detail = error instanceof Error ? error.message : 'unknown';
              logger.error({ error: detail }, 'Failed to start file watcher');
            });
          }

          resolve();
        });
      });
    },

    async stop(): Promise<void> {
      if (state.fileWatcher) {
        await state.fileWatcher.stop();
        state.fileWatcher = null;
      }

      // Stop all workspace watchers
      for (const [rootPath, watcher] of state.fileWatchers) {
        try {
          await watcher.stop();
          logger.debug({ rootPath }, 'Stopped workspace file watcher');
        } catch (error) {
          const detail = error instanceof Error ? error.message : 'unknown';
          logger.warn({ rootPath, error: detail }, 'Failed to stop file watcher');
        }
      }
      state.fileWatchers.clear();

      return new Promise((resolve, reject) => {
        if (!httpServer) {
          resolve();
          return;
        }

        for (const client of clients) {
          client.ws.close(1001, 'Server shutting down');
        }
        clients.clear();

        if (wss) {
          wss.close();
          wss = null;
        }

        const server = httpServer;

        // H5: Force-close keep-alive connections after 5s timeout
        const forceCloseTimer = setTimeout(() => {
          logger.warn('Force-closing remaining connections after timeout');
          server.closeAllConnections();
        }, 5_000);

        server.close((err) => {
          clearTimeout(forceCloseTimer);
          httpServer = null;
          if (err) {
            logger.error({ error: err.message }, 'Error during server close');
            reject(err);
          } else {
            logger.info('Server stopped');
            resolve();
          }
        });
      });
    },

    broadcast(message: ServerMessage): void {
      broadcastMessage(message);
    },

    getClientCount(): number {
      return clients.size;
    },

    getState(): ServerState {
      return state;
    },
  };
}
