/**
 * Tests for crates.io registry client.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { queryCargoRegistry } from '../../../adapters/rust/registryClient.js';
import { createRegistryCache } from '../../../adapters/registryCache.js';
import { createRegistryRateLimiter } from '../../../adapters/registryRateLimiter.js';
import type { RegistryCache } from '../../../adapters/registryCache.js';
import type { RegistryRateLimiter } from '../../../adapters/registryRateLimiter.js';

describe('queryCargoRegistry', () => {
  let cache: RegistryCache;
  let limiter: RegistryRateLimiter;

  beforeEach(() => {
    cache = createRegistryCache({ maxSize: 10, ttlMs: 60_000 });
    limiter = createRegistryRateLimiter({ cargo: 100 });
    vi.restoreAllMocks();
  });

  it('returns metadata for a valid crate', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          crate: {
            max_stable_version: '1.0.197',
            description: 'A serialization framework',
            repository: 'https://github.com/serde-rs/serde',
            downloads: 500_000_000,
          },
          versions: [
            {
              num: '1.0.197',
              license: 'MIT OR Apache-2.0',
              created_at: '2024-02-01T00:00:00Z',
              yanked: false,
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await queryCargoRegistry('serde', cache, limiter);

    expect(result).not.toBeNull();
    expect(result!.latestVersion).toBe('1.0.197');
    expect(result!.license).toBe('MIT OR Apache-2.0');
    expect(result!.downloads).toBe(500_000_000);
  });

  it('returns null for 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Not Found', { status: 404 }),
    );

    const result = await queryCargoRegistry('nonexistent-crate', cache, limiter);
    expect(result).toBeNull();
  });

  it('includes User-Agent header', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          crate: { newest_version: '1.0.0' },
        }),
        { status: 200 },
      ),
    );

    await queryCargoRegistry('serde', cache, limiter);

    const [, options] = fetchSpy.mock.calls[0]!;
    expect(options?.headers).toHaveProperty('User-Agent');
  });

  it('falls back to newest_version when max_stable_version missing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          crate: { newest_version: '2.0.0-beta.1' },
        }),
        { status: 200 },
      ),
    );

    const result = await queryCargoRegistry('beta-crate', cache, limiter);
    expect(result!.latestVersion).toBe('2.0.0-beta.1');
  });

  it('caches results', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          crate: { newest_version: '1.0.0' },
        }),
        { status: 200 },
      ),
    );

    await queryCargoRegistry('serde', cache, limiter);
    await queryCargoRegistry('serde', cache, limiter);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
