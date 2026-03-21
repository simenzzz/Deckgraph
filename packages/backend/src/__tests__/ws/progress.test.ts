/**
 * Tests for WebSocket progress emitter.
 */

import { describe, it, expect, vi } from 'vitest';
import WebSocket from 'ws';
import { createProgressEmitter } from '../../ws/progress.js';
import type { ProgressMessage } from '@deckgraph/shared';

function createMockWs(readyState: number) {
  return {
    readyState,
    send: vi.fn(),
    OPEN: WebSocket.OPEN,
  } as unknown as WebSocket;
}

function createMockLogger() {
  return {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as import('pino').Logger;
}

describe('createProgressEmitter', () => {
  it('sends a valid ProgressMessage when socket is open', () => {
    const ws = createMockWs(WebSocket.OPEN);
    const logger = createMockLogger();
    const emit = createProgressEmitter(ws, logger);

    emit('req-1', 'Scanning modules...', 1);

    expect(ws.send).toHaveBeenCalledOnce();
    const sent = JSON.parse(
      vi.mocked(ws.send).mock.calls[0]![0] as string,
    ) as ProgressMessage;

    expect(sent).toEqual({
      type: 'progress',
      requestId: 'req-1',
      message: 'Scanning modules...',
      phase: 1,
    });
  });

  it('does not throw when socket is closed', () => {
    const ws = createMockWs(WebSocket.CLOSED);
    const logger = createMockLogger();
    const emit = createProgressEmitter(ws, logger);

    expect(() => emit('req-1', 'test', 0)).not.toThrow();
    expect(ws.send).not.toHaveBeenCalled();
  });

  it('logs a warning when socket is not open', () => {
    const ws = createMockWs(WebSocket.CLOSING);
    const logger = createMockLogger();
    const emit = createProgressEmitter(ws, logger);

    emit('req-2', 'test', 2);

    expect(logger.warn).toHaveBeenCalledOnce();
    expect(ws.send).not.toHaveBeenCalled();
  });

  it('sends correct phase values', () => {
    const ws = createMockWs(WebSocket.OPEN);
    const logger = createMockLogger();
    const emit = createProgressEmitter(ws, logger);

    for (const phase of [0, 1, 2, 3] as const) {
      emit('req', `phase ${phase}`, phase);
    }

    expect(ws.send).toHaveBeenCalledTimes(4);
  });
});
