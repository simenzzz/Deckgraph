/**
 * Tests for registry metadata cache.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRegistryCache } from '../../adapters/registryCache.js';
import type { RegistryMeta } from '@deckgraph/shared';

const META: RegistryMeta = {
  latestVersion: '1.0.0',
  description: 'A test package',
  license: 'MIT',
  homepage: 'https://example.com',
  downloads: 1000,
  deprecated: false,
  publishedAt: '2024-01-01T00:00:00Z',
};

describe('createRegistryCache', () => {
  let cache: ReturnType<typeof createRegistryCache>;

  beforeEach(() => {
    cache = createRegistryCache({ maxSize: 10, ttlMs: 60_000 });
  });

  it('returns undefined for uncached entries', () => {
    expect(cache.get('npm', 'express')).toBeUndefined();
  });

  it('stores and retrieves entries', () => {
    cache.set('npm', 'express', META);
    expect(cache.get('npm', 'express')).toEqual(META);
  });

  it('isolates entries by ecosystem', () => {
    cache.set('npm', 'lodash', META);
    expect(cache.get('pypi', 'lodash')).toBeUndefined();
  });

  it('has() returns true for cached entries', () => {
    cache.set('npm', 'express', META);
    expect(cache.has('npm', 'express')).toBe(true);
    expect(cache.has('npm', 'missing')).toBe(false);
  });

  it('delete() removes specific entries', () => {
    cache.set('npm', 'express', META);
    cache.set('npm', 'lodash', META);

    cache.delete('npm', 'express');

    expect(cache.has('npm', 'express')).toBe(false);
    expect(cache.has('npm', 'lodash')).toBe(true);
  });

  it('clear() removes all entries', () => {
    cache.set('npm', 'express', META);
    cache.set('pypi', 'flask', META);

    cache.clear();

    expect(cache.size).toBe(0);
    expect(cache.has('npm', 'express')).toBe(false);
  });

  it('tracks size correctly', () => {
    expect(cache.size).toBe(0);

    cache.set('npm', 'a', META);
    cache.set('npm', 'b', META);
    expect(cache.size).toBe(2);
  });

  it('evicts LRU entries when maxSize exceeded', () => {
    const small = createRegistryCache({ maxSize: 2, ttlMs: 60_000 });

    small.set('npm', 'a', META);
    small.set('npm', 'b', META);
    small.set('npm', 'c', META); // evicts 'a'

    expect(small.has('npm', 'a')).toBe(false);
    expect(small.has('npm', 'b')).toBe(true);
    expect(small.has('npm', 'c')).toBe(true);
  });

  it('uses default options when none provided', () => {
    const defaultCache = createRegistryCache();
    defaultCache.set('npm', 'test', META);
    expect(defaultCache.get('npm', 'test')).toEqual(META);
  });
});
