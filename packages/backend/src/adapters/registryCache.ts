/**
 * Generic LRU cache with TTL for registry metadata.
 *
 * Wraps `lru-cache` with a typed interface for caching
 * ecosystem-specific registry responses.
 */

import { LRUCache } from 'lru-cache';
import type { RegistryMeta } from '@deckgraph/shared';
import { createLogger } from '../logger.js';

const logger = createLogger('registry-cache');

/**
 * Configuration for the registry cache.
 */
export interface RegistryCacheOptions {
  /** Maximum number of cached entries (default: 500) */
  readonly maxSize?: number;
  /** Time-to-live in milliseconds (default: 1 hour) */
  readonly ttlMs?: number;
}

const DEFAULT_MAX_SIZE = 500;
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Typed cache for registry metadata keyed by "ecosystem:packageName".
 */
export interface RegistryCache {
  /** Get cached metadata, or undefined if not cached / expired. */
  get(ecosystem: string, packageName: string): RegistryMeta | undefined;

  /** Cache metadata for a package. */
  set(ecosystem: string, packageName: string, meta: RegistryMeta): void;

  /** Check if an entry exists and is not expired. */
  has(ecosystem: string, packageName: string): boolean;

  /** Remove a specific entry. */
  delete(ecosystem: string, packageName: string): void;

  /** Clear all entries. */
  clear(): void;

  /** Current number of cached entries. */
  readonly size: number;

  /** Get cached metadata for multiple keys. Returns Map of found entries. */
  getMany(keys: readonly { readonly ecosystem: string; readonly packageName: string }[]): Map<string, RegistryMeta>;

  /** Cache multiple entries at once. */
  setMany(entries: readonly { readonly ecosystem: string; readonly packageName: string; readonly meta: RegistryMeta }[]): void;
}

/**
 * Build a composite cache key.
 */
function cacheKey(ecosystem: string, packageName: string): string {
  return `${ecosystem}:${packageName}`;
}

/**
 * Create a new registry cache with LRU eviction and TTL.
 */
export function createRegistryCache(options?: RegistryCacheOptions): RegistryCache {
  const maxSize = options?.maxSize ?? DEFAULT_MAX_SIZE;
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;

  const cache = new LRUCache<string, RegistryMeta>({
    max: maxSize,
    ttl: ttlMs,
  });

  logger.info({ maxSize, ttlMs }, 'Registry cache created');

  return {
    get(ecosystem: string, packageName: string): RegistryMeta | undefined {
      const key = cacheKey(ecosystem, packageName);
      return cache.get(key);
    },

    set(ecosystem: string, packageName: string, meta: RegistryMeta): void {
      const key = cacheKey(ecosystem, packageName);
      cache.set(key, meta);
    },

    has(ecosystem: string, packageName: string): boolean {
      const key = cacheKey(ecosystem, packageName);
      return cache.has(key);
    },

    delete(ecosystem: string, packageName: string): void {
      const key = cacheKey(ecosystem, packageName);
      cache.delete(key);
    },

    clear(): void {
      cache.clear();
    },

    get size(): number {
      return cache.size;
    },

    getMany(keys) {
      const result = new Map<string, RegistryMeta>();
      for (const { ecosystem, packageName } of keys) {
        const key = cacheKey(ecosystem, packageName);
        const meta = cache.get(key);
        if (meta) {
          result.set(key, meta);
        }
      }
      return result;
    },

    setMany(entries) {
      for (const { ecosystem, packageName, meta } of entries) {
        const key = cacheKey(ecosystem, packageName);
        cache.set(key, meta);
      }
    },
  };
}
