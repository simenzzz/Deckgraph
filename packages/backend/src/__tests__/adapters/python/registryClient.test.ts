/**
 * Tests for PyPI registry client.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { queryPypiRegistry } from '../../../adapters/python/registryClient.js';
import { createRegistryCache } from '../../../adapters/registryCache.js';
import { createRegistryRateLimiter } from '../../../adapters/registryRateLimiter.js';
import type { RegistryCache } from '../../../adapters/registryCache.js';
import type { RegistryRateLimiter } from '../../../adapters/registryRateLimiter.js';

describe('queryPypiRegistry', () => {
  let cache: RegistryCache;
  let limiter: RegistryRateLimiter;

  beforeEach(() => {
    cache = createRegistryCache({ maxSize: 10, ttlMs: 60_000 });
    limiter = createRegistryRateLimiter({ pypi: 100 });
    vi.restoreAllMocks();
  });

  it('returns metadata for a valid package', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          info: {
            version: '2.3.3',
            summary: 'A micro web framework',
            license: 'BSD-3-Clause',
            home_page: 'https://flask.palletsprojects.com',
            classifiers: ['Development Status :: 5 - Production/Stable'],
          },
          urls: [{ upload_time_iso_8601: '2023-09-01T00:00:00Z' }],
        }),
        { status: 200 },
      ),
    );

    const result = await queryPypiRegistry('flask', cache, limiter);

    expect(result).not.toBeNull();
    expect(result!.latestVersion).toBe('2.3.3');
    expect(result!.license).toBe('BSD-3-Clause');
    expect(result!.deprecated).toBe(false);
  });

  it('detects deprecated packages via classifier', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          info: {
            version: '1.0.0',
            classifiers: ['Development Status :: 7 - Inactive'],
          },
        }),
        { status: 200 },
      ),
    );

    const result = await queryPypiRegistry('old-pkg', cache, limiter);
    expect(result!.deprecated).toBe(true);
  });

  it('returns null for 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Not Found', { status: 404 }),
    );

    const result = await queryPypiRegistry('nonexistent', cache, limiter);
    expect(result).toBeNull();
  });

  it('uses project_urls as fallback for homepage', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          info: {
            version: '1.0.0',
            home_page: '',
            project_urls: { Source: 'https://github.com/example/pkg' },
          },
        }),
        { status: 200 },
      ),
    );

    const result = await queryPypiRegistry('pkg', cache, limiter);
    expect(result!.homepage).toBe('https://github.com/example/pkg');
  });

  it('caches results', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ info: { version: '1.0.0' } }),
        { status: 200 },
      ),
    );

    await queryPypiRegistry('flask', cache, limiter);
    await queryPypiRegistry('flask', cache, limiter);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
