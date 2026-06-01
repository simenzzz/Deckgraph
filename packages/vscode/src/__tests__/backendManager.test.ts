/**
 * Unit tests for BackendManager.
 *
 * Mocks child_process.spawn and the VS Code API to verify:
 * - Binary path construction
 * - Port extraction from stdout
 * - Restart on crash with exponential backoff
 * - Clean stop prevents restarts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn as actualSpawn } from 'child_process';

// Mock: VS Code API

vi.mock('vscode', () => {
  const disposables: Array<{ dispose(): void }> = [];

  return {
    window: {
      createOutputChannel: () => ({
        _items: [] as string[],
        append(this: { _items: string[] }, text: string) { this._items.push(text); },
        appendLine(this: { _items: string[] }, text: string) { this._items.push(text + '\n'); },
        dispose() {},
        get items() { return this._items; },
      }),
      createTreeView: () => ({ dispose() {} }),
      showInformationMessage: vi.fn(),
      showWarningMessage: vi.fn(),
      showErrorMessage: vi.fn(),
    },
    workspace: {
      workspaceFolders: [
        { uri: { fsPath: '/tmp/test-workspace' } },
      ],
      getConfiguration: () => ({
        get: (_key: string, defaultValue: unknown) => defaultValue,
      }),
    },
    commands: {
      registerCommand: () => ({ dispose() {} }),
    },
    EventEmitter: class {
      get event() { return () => ({ dispose() {} }); }
      fire() {}
      dispose() {}
    },
    TreeItem: class {
      constructor(public label?: string, public collapsibleState?: number) {}
    },
    Disposable: class {
      dispose() {}
    },
  };
});

// Mock: child_process

interface MockChildProcess {
  stdout: { on: ReturnType<typeof vi.fn> };
  stderr: { on: ReturnType<typeof vi.fn> };
  on: ReturnType<typeof vi.fn>;
  kill: ReturnType<typeof vi.fn>;
  killed: boolean;
}

let mockChildProcess: MockChildProcess;

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

const mockedSpawn = vi.mocked(actualSpawn);

// Helpers

function createMockChildProcess(): MockChildProcess {
  const cp: MockChildProcess = {
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn(),
    kill: vi.fn(function (this: MockChildProcess) {
      this.killed = true;
    }),
    killed: false,
  };
  return cp;
}

function createMockContext(backendPath: string) {
  return {
    asAbsolutePath: (relativePath: string) => `/extensions/deckgraph/${relativePath}`,
    subscriptions: [],
  };
}

// Tests

describe('BackendManager', () => {
  let BackendManager: typeof import('../backendManager').BackendManager;

  beforeEach(async () => {
    vi.useFakeTimers();
    mockChildProcess = createMockChildProcess();

    mockedSpawn.mockReturnValue(mockChildProcess as unknown as ReturnType<typeof actualSpawn>);

    const mod = await import('../backendManager');
    BackendManager = mod.BackendManager;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Binary path construction
  // -------------------------------------------------------------------------

  it('spawns the backend with the correct binary path and arguments', () => {
    const context = createMockContext('/extensions/deckgraph/../../backend/dist/index.js');
    const manager = new BackendManager(context);

    manager.start();

    const cp = require('child_process');
    expect(mockedSpawn).toHaveBeenCalledWith(
      'node',
      [
        expect.stringContaining('backend/dist/index.js'),
        '--project',
        '/tmp/test-workspace',
        '--port',
        '3334',
        '--no-open',
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );
  });

  // -------------------------------------------------------------------------
  // Port extraction from stdout
  // -------------------------------------------------------------------------

  it('detects readiness when stdout contains the listening message', () => {
    const context = createMockContext('/extensions/deckgraph/../../backend/dist/index.js');
    const manager = new BackendManager(context);

    const readyCallback = vi.fn();
    manager.onReady(readyCallback);

    manager.start();
    expect(manager.isReady()).toBe(false);

    // Simulate stdout with the ready message
    const stdoutOnCall = mockChildProcess.stdout.on.mock.calls;
    const dataHandler = stdoutOnCall.find(
      (call: [string, unknown]) => call[0] === 'data'
    )?.[1] as ((data: Buffer) => void) | undefined;

    expect(dataHandler).toBeDefined();
    dataHandler!(Buffer.from('Server listening on http://127.0.0.1:3334\n'));

    expect(manager.isReady()).toBe(true);
    expect(readyCallback).toHaveBeenCalled();
  });

  it('extracts the correct port from the ready message', () => {
    const context = createMockContext('/extensions/deckgraph/../../backend/dist/index.js');
    const manager = new BackendManager(context);

    expect(manager.getWsUrl()).toBe('ws://127.0.0.1:3334');
  });

  // -------------------------------------------------------------------------
  // Restart on crash with exponential backoff
  // -------------------------------------------------------------------------

  it('restarts the process after a crash with exponential backoff', () => {
    const context = createMockContext('/extensions/deckgraph/../../backend/dist/index.js');
    const manager = new BackendManager(context);

    manager.start();

    expect(mockedSpawn).toHaveBeenCalledTimes(1);

    // Find the 'exit' handler
    const exitHandler = mockChildProcess.on.mock.calls.find(
      (call: [string, unknown]) => call[0] === 'exit'
    )?.[1] as ((code: number | null, signal: string | null) => void) | undefined;

    expect(exitHandler).toBeDefined();

    // Simulate crash (exit code 1)
    exitHandler!(1, null);

    // Should not have spawned yet (backoff delay)
    expect(mockedSpawn).toHaveBeenCalledTimes(1);

    // Set up second mock BEFORE advancing timers so second spawn returns it
    const secondMockCp = createMockChildProcess();
    (mockedSpawn as ReturnType<typeof vi.fn>).mockReturnValue(secondMockCp);

    // Advance 1s — retry 1 should fire
    vi.advanceTimersByTime(1_000);
    expect(mockedSpawn).toHaveBeenCalledTimes(2);

    // Simulate another crash on the second process
    const secondExitHandler = secondMockCp.on.mock.calls.find(
      (call: [string, unknown]) => call[0] === 'exit'
    )?.[1] as ((code: number | null, signal: string | null) => void) | undefined;

    secondExitHandler!(1, null);

    // Should not spawn yet (2s backoff)
    expect(mockedSpawn).toHaveBeenCalledTimes(2);

    // Set up third mock BEFORE advancing
    const thirdMockCp = createMockChildProcess();
    (mockedSpawn as ReturnType<typeof vi.fn>).mockReturnValue(thirdMockCp);

    // Advance 2s — retry 2 should fire
    vi.advanceTimersByTime(2_000);
    expect(mockedSpawn).toHaveBeenCalledTimes(3);

    // Simulate third crash
    const thirdExitHandler = thirdMockCp.on.mock.calls.find(
      (call: [string, unknown]) => call[0] === 'exit'
    )?.[1] as ((code: number | null, signal: string | null) => void) | undefined;

    thirdExitHandler!(1, null);

    // Set up fourth mock BEFORE advancing
    const fourthMockCp = createMockChildProcess();
    (mockedSpawn as ReturnType<typeof vi.fn>).mockReturnValue(fourthMockCp);

    // Advance 4s — retry 3 should fire
    vi.advanceTimersByTime(4_000);
    expect(mockedSpawn).toHaveBeenCalledTimes(4);

    // Simulate a 4th crash on the fourth process — should NOT restart (max retries reached)
    const fourthExitHandler = fourthMockCp.on.mock.calls.find(
      (call: [string, unknown]) => call[0] === 'exit'
    )?.[1] as ((code: number | null, signal: string | null) => void) | undefined;

    fourthExitHandler!(1, null);

    // Advance plenty of time — should NOT spawn again
    vi.advanceTimersByTime(10_000);
    expect(mockedSpawn).toHaveBeenCalledTimes(4);
  });

  // -------------------------------------------------------------------------
  // Clean stop
  // -------------------------------------------------------------------------

  it('stops the process and prevents restarts', () => {
    const context = createMockContext('/extensions/deckgraph/../../backend/dist/index.js');
    const manager = new BackendManager(context);

    manager.start();

    // Simulate ready
    const dataHandler = mockChildProcess.stdout.on.mock.calls.find(
      (call: [string, unknown]) => call[0] === 'data'
    )?.[1] as ((data: Buffer) => void) | undefined;
    dataHandler!(Buffer.from('Server listening on http://127.0.0.1:3334\n'));

    expect(manager.isReady()).toBe(true);

    // Stop
    manager.stop();

    expect(mockChildProcess.kill).toHaveBeenCalled();
    expect(manager.isReady()).toBe(false);
  });

  it('does not restart after stop even if exit fires', () => {
    const context = createMockContext('/extensions/deckgraph/../../backend/dist/index.js');
    const manager = new BackendManager(context);

    manager.start();

    expect(mockedSpawn).toHaveBeenCalledTimes(1);

    // Stop first, then simulate exit
    manager.stop();

    const exitHandler = mockChildProcess.on.mock.calls.find(
      (call: [string, unknown]) => call[0] === 'exit'
    )?.[1] as ((code: number | null, signal: string | null) => void) | undefined;

    exitHandler!(0, null);

    // Advance time — should NOT restart
    vi.advanceTimersByTime(10_000);
    expect(mockedSpawn).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // onReady fires immediately if already ready
  // -------------------------------------------------------------------------

  it('fires onReady callback immediately if already ready', () => {
    const context = createMockContext('/extensions/deckgraph/../../backend/dist/index.js');
    const manager = new BackendManager(context);

    manager.start();

    // Simulate ready
    const dataHandler = mockChildProcess.stdout.on.mock.calls.find(
      (call: [string, unknown]) => call[0] === 'data'
    )?.[1] as ((data: Buffer) => void) | undefined;
    dataHandler!(Buffer.from('Server listening on http://127.0.0.1:3334\n'));

    // Register callback AFTER ready
    const lateCallback = vi.fn();
    manager.onReady(lateCallback);

    expect(lateCallback).toHaveBeenCalled();
  });
});
