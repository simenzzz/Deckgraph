/**
 * Tests for registry rate limiter.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRegistryRateLimiter } from '../../adapters/registryRateLimiter.js';

describe('createRegistryRateLimiter', () => {
  let currentTime: number;
  const nowFn = () => currentTime;

  beforeEach(() => {
    currentTime = 1000;
    vi.useFakeTimers();
  });

  it('allows requests within rate limit', async () => {
    const limiter = createRegistryRateLimiter({ npm: 3 }, nowFn);

    await limiter.acquire('npm');
    await limiter.acquire('npm');
    await limiter.acquire('npm');

    // All three should resolve immediately
  });

  it('delays when rate limit exceeded', async () => {
    const limiter = createRegistryRateLimiter({ npm: 1 }, nowFn);

    await limiter.acquire('npm'); // immediate

    // Second request should be delayed
    const acquirePromise = limiter.acquire('npm');

    // Advance time past the window
    currentTime += 1001;
    vi.advanceTimersByTime(1001);

    await acquirePromise;
  });

  it('isolates rate limits per ecosystem', async () => {
    const limiter = createRegistryRateLimiter(
      { npm: 1, pypi: 1 },
      nowFn,
    );

    await limiter.acquire('npm');
    await limiter.acquire('pypi');

    // Both should resolve immediately since they're different ecosystems
  });

  it('reset() clears all state', async () => {
    const limiter = createRegistryRateLimiter({ npm: 1 }, nowFn);

    await limiter.acquire('npm');
    limiter.reset();

    // After reset, should be able to acquire again immediately
    await limiter.acquire('npm');
  });

  it('uses default limits when not overridden', async () => {
    const limiter = createRegistryRateLimiter(undefined, nowFn);

    // cargo has default limit of 1/s
    await limiter.acquire('cargo');

    // Second cargo request within same second should delay
    const acquirePromise = limiter.acquire('cargo');

    currentTime += 1001;
    vi.advanceTimersByTime(1001);

    await acquirePromise;
  });

  it('prunes old timestamps after window passes', async () => {
    const limiter = createRegistryRateLimiter({ npm: 2 }, nowFn);

    await limiter.acquire('npm');
    await limiter.acquire('npm');

    // Advance past the window
    currentTime += 1500;

    // Should be able to acquire again (old timestamps pruned)
    await limiter.acquire('npm');
  });
});
