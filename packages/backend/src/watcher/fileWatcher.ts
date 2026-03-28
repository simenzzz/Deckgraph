/**
 * File watcher for incremental re-scanning.
 *
 * Watches the project root for file changes, debounces rapid changes,
 * uses content hashing to skip unchanged files, and maps changed files
 * to affected modules.
 */

import chokidar from 'chokidar';
import type { FSWatcher } from 'chokidar';
import type { Module } from '@deckgraph/shared';
import { DEFAULT_IGNORE_PATTERNS } from '../discovery/moduleDiscovery.js';
import { initHasher, hashFile } from './contentHasher.js';
import { createLogger } from '../logger.js';

const logger = createLogger('fileWatcher');

const DEBOUNCE_MS = 300;

/**
 * Event emitted when file changes are detected.
 */
export interface FileChangeEvent {
  readonly changedFiles: readonly string[];
  readonly addedFiles: readonly string[];
  readonly removedFiles: readonly string[];
  readonly affectedModules: readonly string[];
}

/**
 * Options for creating a file watcher.
 */
export interface FileWatcherOptions {
  readonly projectRoot: string;
  readonly modules: readonly Module[];
}

/**
 * Public interface for the file watcher.
 */
export interface FileWatcher {
  start(): Promise<void>;
  stop(): Promise<void>;
  setModules(modules: readonly Module[]): void;
  onChanges(callback: (event: FileChangeEvent) => void): () => void;
}

/**
 * Create a file watcher for a project root.
 */
export function createFileWatcher(options: FileWatcherOptions): FileWatcher {
  let watcher: FSWatcher | null = null;
  let modules: readonly Module[] = options.modules;
  const callbacks = new Set<(event: FileChangeEvent) => void>();
  const hashMap = new Map<string, string>();

  let pendingChanges: string[] = [];
  let pendingAdds: string[] = [];
  let pendingRemoves: string[] = [];
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function mapFileToModules(filePath: string): readonly string[] {
    const matched: string[] = [];
    for (const mod of modules) {
      if (filePath.startsWith(mod.path + '/') || filePath === mod.path) {
        matched.push(mod.path);
      }
    }
    return matched;
  }

  async function flushChanges(): Promise<void> {
    const changedFiles = [...pendingChanges];
    const addedFiles = [...pendingAdds];
    const removedFiles = [...pendingRemoves];
    pendingChanges = [];
    pendingAdds = [];
    pendingRemoves = [];

    const actualChanged: string[] = [];
    const actualAdded: string[] = [];

    for (const filePath of addedFiles) {
      try {
        const hash = await hashFile(filePath);
        const prevHash = hashMap.get(filePath);
        if (prevHash !== hash) {
          hashMap.set(filePath, hash);
          actualAdded.push(filePath);
        }
      } catch {
        // File may have been deleted between detection and hash
      }
    }

    for (const filePath of changedFiles) {
      try {
        const hash = await hashFile(filePath);
        const prevHash = hashMap.get(filePath);
        if (prevHash !== hash) {
          hashMap.set(filePath, hash);
          actualChanged.push(filePath);
        }
      } catch {
        // File may have been deleted between detection and hash
      }
    }

    for (const filePath of removedFiles) {
      hashMap.delete(filePath);
    }

    const allFiles = [...actualChanged, ...actualAdded, ...removedFiles];
    if (allFiles.length === 0) return;

    const affectedSet = new Set<string>();
    for (const filePath of allFiles) {
      for (const mod of mapFileToModules(filePath)) {
        affectedSet.add(mod);
      }
    }

    const event: FileChangeEvent = {
      changedFiles: actualChanged,
      addedFiles: actualAdded,
      removedFiles,
      affectedModules: [...affectedSet],
    };

    logger.info(
      {
        changed: actualChanged.length,
        added: actualAdded.length,
        removed: removedFiles.length,
        modules: event.affectedModules.length,
      },
      'File changes detected',
    );

    for (const cb of callbacks) {
      try {
        cb(event);
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'unknown';
        logger.error({ error: detail }, 'Error in file change callback');
      }
    }
  }

  function scheduleFlush(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      flushChanges().catch((error) => {
        const detail = error instanceof Error ? error.message : 'unknown';
        logger.error({ error: detail }, 'Error flushing file changes');
      });
    }, DEBOUNCE_MS);
  }

  return {
    async start(): Promise<void> {
      await initHasher();

      watcher = chokidar.watch(options.projectRoot, {
        ignored: [...DEFAULT_IGNORE_PATTERNS],
        ignoreInitial: true,
        persistent: true,
        awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
      });

      watcher.on('change', (filePath: string) => {
        pendingChanges.push(filePath);
        scheduleFlush();
      });

      watcher.on('add', (filePath: string) => {
        pendingAdds.push(filePath);
        scheduleFlush();
      });

      watcher.on('unlink', (filePath: string) => {
        pendingRemoves.push(filePath);
        scheduleFlush();
      });

      watcher.on('error', (error: unknown) => {
        const detail = error instanceof Error ? error.message : 'unknown';
        logger.error({ error: detail }, 'File watcher error');
      });

      logger.info({ root: options.projectRoot }, 'File watcher started');
    },

    async stop(): Promise<void> {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      if (watcher) {
        await watcher.close();
        watcher = null;
      }
      callbacks.clear();
      logger.info('File watcher stopped');
    },

    setModules(updated: readonly Module[]): void {
      modules = updated;
    },

    onChanges(callback: (event: FileChangeEvent) => void): () => void {
      callbacks.add(callback);
      return () => {
        callbacks.delete(callback);
      };
    },
  };
}
