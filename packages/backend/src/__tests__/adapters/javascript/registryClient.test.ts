/**
 * Tests for npm registry client.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { queryNpmRegistry } from '../../../adapters/javascript/registryClient.js';
import { createRegistryCache } from '../../../adapters/registryCache.js';
import { createRegistryRateLimiter } from '../../../adapters/registryRateLimiter.js';
import type { RegistryCache } from '../../../adapters/registryCache.js';
import type { RegistryRateLimiter } from '../../../adapters/registryRateLimiter.js';

describe('queryNpmRegistry', () => {
  let cache: RegistryCache;
  let limiter: RegistryRateLimiter;

  beforeEach(() => {
    cache = createRegistryCache({ maxSize: 10, ttlMs: 60_000 });
    limiter = createRegistryRateLimiter({ npm: 100 });
    vi.restoreAllMocks();
  });

  it('returns metadata for a valid package', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          'dist-tags': { latest: '4.18.2' },
          description: 'Fast web framework',
          license: 'MIT',
          homepage: 'https://expressjs.com',
          time: { '4.18.2': '2023-10-01T00:00:00Z' },
        }),
        { status: 200 },
      ),
    );

    const result = await queryNpmRegistry('express', cache, limiter);

    if (result.status !== 'found') throw new Error(`expected found, got ${result.status}`);
    expect(result.meta.latestVersion).toBe('4.18.2');
    expect(result.meta.description).toBe('Fast web framework');
    expect(result.meta.license).toBe('MIT');
    expect(result.meta.deprecated).toBe(false);
  });

  it('returns not-found for 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Not Found', { status: 404 }),
    );

    const result = await queryNpmRegistry('nonexistent-pkg-abc', cache, limiter);
    expect(result).toEqual({ status: 'not-found' });
  });

  it('returns cached result on second call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          'dist-tags': { latest: '1.0.0' },
          description: 'cached',
        }),
        { status: 200 },
      ),
    );

    await queryNpmRegistry('test-pkg', cache, limiter);
    const second = await queryNpmRegistry('test-pkg', cache, limiter);

    if (second.status !== 'found') throw new Error(`expected found, got ${second.status}`);
    expect(second.meta.latestVersion).toBe('1.0.0');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('detects deprecated packages', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          'dist-tags': { latest: '2.0.0' },
          deprecated: 'Use something else',
        }),
        { status: 200 },
      ),
    );

    const result = await queryNpmRegistry('old-pkg', cache, limiter);
    if (result.status !== 'found') throw new Error(`expected found, got ${result.status}`);
    expect(result.meta.deprecated).toBe(true);
  });

  it('returns error on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const result = await queryNpmRegistry('express', cache, limiter);
    expect(result).toEqual({ status: 'error' });
  });

  it('returns error when no latest dist-tag', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ 'dist-tags': {} }),
        { status: 200 },
      ),
    );

    const result = await queryNpmRegistry('broken-pkg', cache, limiter);
    expect(result).toEqual({ status: 'error' });
  });
});
