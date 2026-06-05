/**
 * Tests for Maven Central registry client.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  queryMavenRegistry,
  parseMavenCoordinate,
} from '../../../adapters/java/registryClient.js';
import { createRegistryCache } from '../../../adapters/registryCache.js';
import { createRegistryRateLimiter } from '../../../adapters/registryRateLimiter.js';
import type { RegistryCache } from '../../../adapters/registryCache.js';
import type { RegistryRateLimiter } from '../../../adapters/registryRateLimiter.js';

describe('parseMavenCoordinate', () => {
  it('parses colon-separated coordinate', () => {
    const result = parseMavenCoordinate('com.google.guava:guava');
    expect(result).toEqual({ group: 'com.google.guava', artifact: 'guava' });
  });

  it('parses dot-separated as last-segment heuristic', () => {
    const result = parseMavenCoordinate('com.google.guava');
    expect(result).toEqual({ group: 'com.google', artifact: 'guava' });
  });

  it('returns null for single segment', () => {
    const result = parseMavenCoordinate('guava');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    const result = parseMavenCoordinate('');
    expect(result).toBeNull();
  });
});

describe('queryMavenRegistry', () => {
  let cache: RegistryCache;
  let limiter: RegistryRateLimiter;

  beforeEach(() => {
    cache = createRegistryCache({ maxSize: 10, ttlMs: 60_000 });
    limiter = createRegistryRateLimiter({ maven: 100 });
    vi.restoreAllMocks();
  });

  it('returns metadata for a valid artifact', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          response: {
            numFound: 1,
            docs: [
              {
                latestVersion: '33.1.0-jre',
                timestamp: 1700000000000,
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    const result = await queryMavenRegistry('com.google.guava:guava', cache, limiter);

    if (result.status !== 'found') throw new Error(`expected found, got ${result.status}`);
    expect(result.meta.latestVersion).toBe('33.1.0-jre');
    expect(result.meta.homepage).toContain('com.google.guava');
  });

  it('returns not-found for no results', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          response: { numFound: 0, docs: [] },
        }),
        { status: 200 },
      ),
    );

    const result = await queryMavenRegistry('com.nonexistent:artifact', cache, limiter);
    expect(result).toEqual({ status: 'not-found' });
  });

  it('returns not-found for unparseable coordinate', async () => {
    const result = await queryMavenRegistry('single-segment', cache, limiter);
    expect(result).toEqual({ status: 'not-found' });
  });

  it('caches results', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          response: {
            numFound: 1,
            docs: [{ latestVersion: '1.0.0' }],
          },
        }),
        { status: 200 },
      ),
    );

    await queryMavenRegistry('com.example:lib', cache, limiter);
    await queryMavenRegistry('com.example:lib', cache, limiter);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
