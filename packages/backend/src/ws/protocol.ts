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
  ProjectOverviewMessage,
  ViewResultMessage,
  ErrorMessage,
  ViewQuery,
} from '@deckgraph/shared';
import { clientMessageSchema } from '@deckgraph/shared';
import { scanProject } from '../scanner/scanner.js';
import { executeQuery } from '../graph/queryEngine.js';
import { createLogger } from '../logger.js';
import type { ClientConnection, ProgressEmitter, ServerState } from './types.js';

const logger = createLogger('protocol');

const VALID_TYPES = [
  'scan_project',
  'view_query',
  'sync',
  'analyze_imports',
  'enrich_dependency',
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
): Promise<ServerMessage> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    logger.warn({ clientId: connection.clientId }, 'Received invalid JSON');
    return createError(
      'unknown',
      'Invalid JSON received',
      'Ensure the message is valid JSON',
    );
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
      return createError(
        'unknown',
        'Message validation failed',
        `Valid message types: ${VALID_TYPES.join(', ')}`,
      );
    }
    throw error;
  }

  return dispatch(parsed, state, emitProgress);
}

/**
 * Dispatch a validated client message to its handler.
 * Exhaustive switch with TypeScript never check.
 */
async function dispatch(
  message: ClientMessage,
  state: ServerState,
  emitProgress: ProgressEmitter,
): Promise<ServerMessage> {
  try {
    switch (message.type) {
      case 'scan_project':
        return await handleScanProject(message.requestId, state, emitProgress);

      case 'view_query':
        return handleViewQuery(message.requestId, message.query, state);

      case 'sync':
        return handleSync(message.requestId, state);

      case 'analyze_imports':
        return createError(
          message.requestId,
          'Import analysis is not yet available',
          'This feature will be available in Phase 2',
        );

      case 'enrich_dependency':
        return createError(
          message.requestId,
          'Dependency enrichment is not yet available',
          'This feature will be available in Phase 2',
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
    return createError(
      message.requestId,
      'An internal error occurred while processing your request',
      'Try again or check server logs for details',
    );
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
    return createError(
      requestId,
      'A scan is already in progress',
      'Wait for the current scan to complete before starting another',
    );
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
 * Handle view_query: filter the graph and return results.
 */
function handleViewQuery(
  requestId: string,
  query: ViewQuery,
  state: ServerState,
): ServerMessage {
  if (!state.scanResult) {
    return createError(
      requestId,
      'No scan data available',
      'Run a scan_project request first',
    );
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
    return createError(
      requestId,
      'No scan data available',
      'Run a scan_project request first',
    );
  }

  const overview: ProjectOverviewMessage = {
    type: 'project_overview',
    requestId,
    data: state.scanResult.project,
  };

  return overview;
}

/**
 * Create an ErrorMessage with the standard format.
 */
function createError(
  requestId: string,
  message: string,
  suggestion: string,
): ErrorMessage {
  return {
    type: 'error',
    requestId,
    message,
    suggestion,
  };
}
