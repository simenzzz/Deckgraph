/**
 * Tests for the WebSocket client.
 * Mocks the browser WebSocket API.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWsClient, createRequestId, getWsUrl, type WsClient } from '@/lib/wsClient';

// Mock browser WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;

  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    // Auto-connect after microtask
    setTimeout(() => this.simulateOpen(), 0);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: 1000, reason: '' } as CloseEvent);
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.({} as Event);
  }

  simulateMessage(data: string) {
    this.onmessage?.({ data } as MessageEvent);
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: 1006, reason: '' } as CloseEvent);
  }
}

let mockInstance: MockWebSocket | null = null;
let rafCallbacks: Array<() => void> = [];
let rafIdCounter = 0;

beforeEach(() => {
  mockInstance = null;
  rafCallbacks = [];
  rafIdCounter = 0;
  vi.stubGlobal('WebSocket', class extends MockWebSocket {
    constructor(url: string) {
      super(url);
      mockInstance = this;
    }
  });
  // Stub requestAnimationFrame / cancelAnimationFrame
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
    const id = ++rafIdCounter;
    rafCallbacks.push(cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    // Simplified: just clear all pending callbacks
    rafCallbacks = [];
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Flush all pending requestAnimationFrame callbacks. */
function flushRaf(): void {
  const pending = [...rafCallbacks];
  rafCallbacks = [];
  for (const cb of pending) {
    cb();
  }
}

function createTestClient(overrides?: Partial<Parameters<typeof createWsClient>[0]>): WsClient {
  return createWsClient({
    url: 'ws://127.0.0.1:3333',
    onMessage: vi.fn(),
    onStatusChange: vi.fn(),
    ...overrides,
  });
}

describe('createWsClient', () => {
  it('connects and reports status changes', async () => {
    const onStatusChange = vi.fn();
    const client = createTestClient({ onStatusChange });

    client.connect();
    expect(onStatusChange).toHaveBeenCalledWith('connecting');

    // Let mock auto-connect
    await vi.advanceTimersByTimeAsync(1);
    expect(onStatusChange).toHaveBeenCalledWith('connected');
    expect(client.getStatus()).toBe('connected');

    client.disconnect();
  });

  it('validates incoming messages with Zod', async () => {
    const onMessage = vi.fn();
    const client = createTestClient({ onMessage });

    client.connect();
    await vi.advanceTimersByTimeAsync(1);

    // Send a valid server message
    mockInstance!.simulateMessage(JSON.stringify({
      type: 'progress',
      requestId: 'r1',
      message: 'Scanning...',
      phase: 0,
    }));

    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'progress',
      requestId: 'r1',
    }));

    client.disconnect();
  });

  it('calls onValidationError for invalid messages', async () => {
    const onValidationError = vi.fn();
    const onMessage = vi.fn();
    const client = createTestClient({ onMessage, onValidationError });

    client.connect();
    await vi.advanceTimersByTimeAsync(1);

    mockInstance!.simulateMessage(JSON.stringify({ type: 'unknown_type' }));

    expect(onMessage).not.toHaveBeenCalled();
    expect(onValidationError).toHaveBeenCalled();

    client.disconnect();
  });

  it('calls onValidationError for non-JSON messages', async () => {
    const onValidationError = vi.fn();
    const client = createTestClient({ onValidationError });

    client.connect();
    await vi.advanceTimersByTimeAsync(1);

    mockInstance!.simulateMessage('not json');

    expect(onValidationError).toHaveBeenCalledWith(
      expect.any(Error),
      'not json',
    );

    client.disconnect();
  });

  it('send serializes and sends ClientMessage', async () => {
    const client = createTestClient();

    client.connect();
    await vi.advanceTimersByTimeAsync(1);

    client.send({ type: 'scan_project', requestId: 'r1' });

    // Flush the rAF batch
    flushRaf();

    expect(mockInstance!.sent).toHaveLength(1);
    expect(JSON.parse(mockInstance!.sent[0])).toEqual({
      type: 'scan_project',
      requestId: 'r1',
    });

    client.disconnect();
  });

  it('disconnect stops reconnection and sets status', async () => {
    const onStatusChange = vi.fn();
    const client = createTestClient({ onStatusChange });

    client.connect();
    await vi.advanceTimersByTimeAsync(1);

    client.disconnect();
    expect(client.getStatus()).toBe('disconnected');
    expect(onStatusChange).toHaveBeenCalledWith('disconnected');
  });

  it('reconnects with backoff on unexpected close', async () => {
    const onStatusChange = vi.fn();
    const client = createTestClient({ onStatusChange });

    client.connect();
    await vi.advanceTimersByTimeAsync(1);

    // Simulate unexpected close
    mockInstance!.simulateClose();
    expect(onStatusChange).toHaveBeenCalledWith('reconnecting');

    // Advance past first backoff (1s)
    await vi.advanceTimersByTimeAsync(1000);
    expect(onStatusChange).toHaveBeenCalledWith('connecting');

    client.disconnect();
  });

  it('sends sync on reconnect', async () => {
    const client = createTestClient();

    client.connect();
    await vi.advanceTimersByTimeAsync(1);

    // Simulate disconnect
    mockInstance!.simulateClose();

    // Advance past backoff
    await vi.advanceTimersByTimeAsync(1000);

    // New connection opens
    await vi.advanceTimersByTimeAsync(1);

    // Flush the rAF batch (sync message is queued via send())
    flushRaf();

    // Should have sent a sync message
    const lastSent = mockInstance!.sent[mockInstance!.sent.length - 1];
    expect(JSON.parse(lastSent)).toMatchObject({ type: 'sync' });

    client.disconnect();
  });
});

describe('createRequestId', () => {
  it('returns a non-empty string', () => {
    const id = createRequestId();
    expect(id.length).toBeGreaterThan(0);
  });

  it('returns unique values', () => {
    const ids = new Set(Array.from({ length: 10 }, () => createRequestId()));
    expect(ids.size).toBe(10);
  });
});

describe('WS batching', () => {
  it('batches multiple sends into a single rAF flush', async () => {
    const client = createTestClient();

    client.connect();
    await vi.advanceTimersByTimeAsync(1);

    // Send multiple messages in the same tick
    client.send({ type: 'scan_project', requestId: 'r1' });
    client.send({ type: 'scan_project', requestId: 'r2' });
    client.send({ type: 'scan_project', requestId: 'r3' });

    // Nothing sent yet — queued
    expect(mockInstance!.sent).toHaveLength(0);

    // Flush the rAF — all three should be sent in one frame
    flushRaf();

    expect(mockInstance!.sent).toHaveLength(3);
    expect(JSON.parse(mockInstance!.sent[0])).toMatchObject({ requestId: 'r1' });
    expect(JSON.parse(mockInstance!.sent[1])).toMatchObject({ requestId: 'r2' });
    expect(JSON.parse(mockInstance!.sent[2])).toMatchObject({ requestId: 'r3' });

    client.disconnect();
  });

  it('clears pending queue on disconnect', async () => {
    const client = createTestClient();

    client.connect();
    await vi.advanceTimersByTimeAsync(1);

    client.send({ type: 'scan_project', requestId: 'r1' });

    // Disconnect before rAF fires
    client.disconnect();

    // Flush — nothing should be sent (queue was cleared)
    flushRaf();

    expect(mockInstance!.sent).toHaveLength(0);
  });
});

describe('getWsUrl', () => {
  it('returns a ws:// URL', () => {
    const url = getWsUrl();
    expect(url).toMatch(/^wss?:\/\//);
  });
});
