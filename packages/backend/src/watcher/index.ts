export {
  initHasher,
  computeHash,
  hashFile,
  diffHashes,
  type ContentHashDiff,
} from './contentHasher.js';

export {
  createFileWatcher,
  type FileWatcher,
  type FileWatcherOptions,
  type FileChangeEvent,
} from './fileWatcher.js';
