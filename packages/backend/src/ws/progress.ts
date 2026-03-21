/**
 * Progress emission for long-running operations.
 *
 * Best-effort delivery: checks readyState before sending,
 * logs a warning if the socket is closed. No queuing.
 */

import WebSocket from 'ws';
import type { Logger } from '../logger.js';
import type { ProgressMessage } from '@deckgraph/shared';
import type { ProgressEmitter } from './types.js';

/**
 * Create a progress emitter bound to a specific WebSocket connection.
 */
export function createProgressEmitter(
  ws: WebSocket,
  logger: Logger,
): ProgressEmitter {
  return (
    requestId: string,
    message: string,
    phase: 0 | 1 | 2 | 3,
  ): void => {
    if (ws.readyState !== WebSocket.OPEN) {
      logger.warn(
        { requestId, phase },
        'Cannot send progress — WebSocket not open',
      );
      return;
    }

    const progressMessage: ProgressMessage = {
      type: 'progress',
      requestId,
      message,
      phase,
    };

    ws.send(JSON.stringify(progressMessage));
  };
}
