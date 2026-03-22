/**
 * Tests for Go proxy registry client.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { queryGoRegistry } from '../../../adapters/go/registryClient.js';
import { createRegistryCache } from '../../../adapters/registryCache.js';
import { createRegistryRateLimiter } from '../../../adapters/registryRateLimiter.js';
import type { RegistryCache } from '../../../adapters/registryCache.js';
import type { RegistryRateLimiter } from '../../../adapters/registryRateLimiter.js';

describe('queryGoRegistry', () => {
  let cache: RegistryCache;
  let limiter: RegistryRateLimiter;

  beforeEach(() => {
    cache = createRegistryCache({ maxSize: 10, ttlMs: 60_000 });
    limiter = createRegistryRateLimiter({ go: 100 });
    vi.restoreAllMocks();
  });

  it('returns metadata for a valid module', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          Version: 'v1.9.7',
          Time: '2024-01-15T00:00:00Z',
        }),
        { status: 200 },
      ),
    );

    const result = await queryGoRegistry('github.com/gin-gonic/gin', cache, limiter);

    expect(result).not.toBeNull();
    expect(result!.latestVersion).toBe('v1.9.7');
    expect(result!.homepage).toBe('https://pkg.go.dev/github.com/gin-gonic/gin');
  });

  it('returns null for 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Not Found', { status: 404 }),
    );

    const result = await queryGoRegistry('github.com/nonexistent/mod', cache, limiter);
    expect(result).toBeNull();
  });

  it('returns null for 410 (gone)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Gone', { status: 410 }),
    );

    const result = await queryGoRegistry('github.com/removed/mod', cache, limiter);
    expect(result).toBeNull();
  });

  it('caches results', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ Version: 'v1.0.0' }),
        { status: 200 },
      ),
    );

    await queryGoRegistry('github.com/example/mod', cache, limiter);
    await queryGoRegistry('github.com/example/mod', cache, limiter);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
