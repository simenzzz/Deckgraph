import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Module } from '@deckgraph/shared';

// Mock chokidar before importing fileWatcher
vi.mock('chokidar', () => {
  const handlers = new Map<string, Function[]>();
  const mockWatcher = {
    on: vi.fn((event: string, handler: Function) => {
      const existing = handlers.get(event) ?? [];
      existing.push(handler);
      handlers.set(event, existing);
      return mockWatcher;
    }),
    close: vi.fn(() => Promise.resolve()),
    _handlers: handlers,
    _emit: (event: string, ...args: unknown[]) => {
      const fns = handlers.get(event) ?? [];
      for (const fn of fns) fn(...args);
    },
    _reset: () => handlers.clear(),
  };

  return {
    default: {
      watch: vi.fn(() => mockWatcher),
    },
    _mockWatcher: mockWatcher,
  };
});

// Mock content hasher
vi.mock('../../watcher/contentHasher.js', () => {
  let callCount = 0;
  return {
    initHasher: vi.fn(() => Promise.resolve()),
    hashFile: vi.fn((filePath: string) => {
      callCount++;
      return Promise.resolve(`hash-${filePath}-${callCount}`);
    }),
  };
});

import { createFileWatcher } from '../../watcher/fileWatcher.js';
// @ts-expect-error — accessing mock internals
import { _mockWatcher } from 'chokidar';

const mockModules: readonly Module[] = [
  {
    path: 'services/api',
    name: 'api-gateway',
    ecosystem: 'npm',
    manifests: ['services/api/package.json'],
    dependencies: [],
    analysisState: 'manifest-only',
  },
  {
    path: 'services/auth',
    name: 'auth-service',
    ecosystem: 'pypi',
    manifests: ['services/auth/pyproject.toml'],
    dependencies: [],
    analysisState: 'manifest-only',
  },
];

describe('fileWatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _mockWatcher._reset();
    _mockWatcher.on.mockClear();
    _mockWatcher.close.mockClear();
  });

  it('should register chokidar event handlers on start', async () => {
    const watcher = createFileWatcher({ projectRoot: '/test', modules: mockModules });
    await watcher.start();

    expect(_mockWatcher.on).toHaveBeenCalledWith('change', expect.any(Function));
    expect(_mockWatcher.on).toHaveBeenCalledWith('add', expect.any(Function));
    expect(_mockWatcher.on).toHaveBeenCalledWith('unlink', expect.any(Function));
    expect(_mockWatcher.on).toHaveBeenCalledWith('error', expect.any(Function));

    await watcher.stop();
  });

  it('should call onChanges callback after debounce', async () => {
    const watcher = createFileWatcher({ projectRoot: '/test', modules: mockModules });
    const callback = vi.fn();
    watcher.onChanges(callback);
    await watcher.start();

    _mockWatcher._emit('change', 'services/api/src/index.ts');

    // Before debounce
    expect(callback).not.toHaveBeenCalled();

    // After debounce
    await vi.advanceTimersByTimeAsync(400);

    expect(callback).toHaveBeenCalledTimes(1);
    const event = callback.mock.calls[0][0];
    expect(event.changedFiles).toContain('services/api/src/index.ts');
    expect(event.affectedModules).toContain('services/api');

    await watcher.stop();
  });

  it('should map files to correct modules', async () => {
    const watcher = createFileWatcher({ projectRoot: '/test', modules: mockModules });
    const callback = vi.fn();
    watcher.onChanges(callback);
    await watcher.start();

    _mockWatcher._emit('change', 'services/auth/handler.py');
    await vi.advanceTimersByTimeAsync(400);

    const event = callback.mock.calls[0][0];
    expect(event.affectedModules).toContain('services/auth');
    expect(event.affectedModules).not.toContain('services/api');

    await watcher.stop();
  });

  it('should handle added files', async () => {
    const watcher = createFileWatcher({ projectRoot: '/test', modules: mockModules });
    const callback = vi.fn();
    watcher.onChanges(callback);
    await watcher.start();

    _mockWatcher._emit('add', 'services/api/src/new.ts');
    await vi.advanceTimersByTimeAsync(400);

    const event = callback.mock.calls[0][0];
    expect(event.addedFiles).toContain('services/api/src/new.ts');

    await watcher.stop();
  });

  it('should handle removed files', async () => {
    const watcher = createFileWatcher({ projectRoot: '/test', modules: mockModules });
    const callback = vi.fn();
    watcher.onChanges(callback);
    await watcher.start();

    _mockWatcher._emit('unlink', 'services/api/src/old.ts');
    await vi.advanceTimersByTimeAsync(400);

    const event = callback.mock.calls[0][0];
    expect(event.removedFiles).toContain('services/api/src/old.ts');

    await watcher.stop();
  });

  it('should batch rapid changes', async () => {
    const watcher = createFileWatcher({ projectRoot: '/test', modules: mockModules });
    const callback = vi.fn();
    watcher.onChanges(callback);
    await watcher.start();

    _mockWatcher._emit('change', 'services/api/src/a.ts');
    _mockWatcher._emit('change', 'services/api/src/b.ts');
    _mockWatcher._emit('change', 'services/auth/handler.py');

    await vi.advanceTimersByTimeAsync(400);

    expect(callback).toHaveBeenCalledTimes(1);
    const event = callback.mock.calls[0][0];
    expect(event.changedFiles.length).toBe(3);
    expect(event.affectedModules).toContain('services/api');
    expect(event.affectedModules).toContain('services/auth');

    await watcher.stop();
  });

  it('should unsubscribe callback', async () => {
    const watcher = createFileWatcher({ projectRoot: '/test', modules: mockModules });
    const callback = vi.fn();
    const unsubscribe = watcher.onChanges(callback);
    await watcher.start();

    unsubscribe();

    _mockWatcher._emit('change', 'services/api/src/index.ts');
    await vi.advanceTimersByTimeAsync(400);

    expect(callback).not.toHaveBeenCalled();

    await watcher.stop();
  });

  it('should close chokidar on stop', async () => {
    const watcher = createFileWatcher({ projectRoot: '/test', modules: mockModules });
    await watcher.start();
    await watcher.stop();

    expect(_mockWatcher.close).toHaveBeenCalled();
  });

  it('should update modules via setModules', async () => {
    const watcher = createFileWatcher({ projectRoot: '/test', modules: [] });
    const callback = vi.fn();
    watcher.onChanges(callback);
    await watcher.start();

    // Initially no modules, so no affected modules
    _mockWatcher._emit('change', 'services/api/src/index.ts');
    await vi.advanceTimersByTimeAsync(400);

    const event1 = callback.mock.calls[0][0];
    expect(event1.affectedModules).toEqual([]);

    // After updating modules, changes should map
    watcher.setModules(mockModules);
    _mockWatcher._emit('change', 'services/api/src/index.ts');
    await vi.advanceTimersByTimeAsync(400);

    const event2 = callback.mock.calls[1][0];
    expect(event2.affectedModules).toContain('services/api');

    await watcher.stop();
  });
});
