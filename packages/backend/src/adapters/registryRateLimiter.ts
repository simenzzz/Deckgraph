/**
 * Per-ecosystem sliding window rate limiter for registry API calls.
 *
 * Prevents hitting registry rate limits by queueing and throttling
 * requests per ecosystem.
 */

import type { Ecosystem } from '@deckgraph/shared';

/**
 * Rate limits per ecosystem (requests per second).
 */
const DEFAULT_LIMITS: Readonly<Record<Ecosystem, number>> = {
  npm: 50,
  pypi: 10,
  go: 10,
  cargo: 1,
  maven: 5,
};

/**
 * Rate limiter interface.
 */
export interface RegistryRateLimiter {
  /**
   * Wait until a request can be made for this ecosystem.
   * Resolves immediately if within rate limit, otherwise delays.
   */
  acquire(ecosystem: Ecosystem): Promise<void>;

  /** Reset all rate limiter state (for testing). */
  reset(): void;
}

interface WindowState {
  readonly timestamps: number[];
  readonly maxPerSecond: number;
}

/**
 * Create a rate limiter with per-ecosystem sliding windows.
 *
 * @param limits - Override default rate limits per ecosystem
 * @param nowFn - Clock function for testing (default: Date.now)
 */
export function createRegistryRateLimiter(
  limits?: Partial<Readonly<Record<Ecosystem, number>>>,
  nowFn: () => number = Date.now,
): RegistryRateLimiter {
  const resolvedLimits = { ...DEFAULT_LIMITS, ...limits };

  const windows = new Map<Ecosystem, WindowState>();

  function getWindow(ecosystem: Ecosystem): WindowState {
    const existing = windows.get(ecosystem);
    if (existing) return existing;
    const state: WindowState = {
      timestamps: [],
      maxPerSecond: resolvedLimits[ecosystem],
    };
    windows.set(ecosystem, state);
    return state;
  }

  function pruneOld(state: WindowState, now: number): void {
    const cutoff = now - 1000;
    // Remove timestamps older than 1 second (mutates the internal array,
    // but WindowState.timestamps is an implementation detail, not shared externally)
    while (state.timestamps.length > 0 && state.timestamps[0]! < cutoff) {
      state.timestamps.shift();
    }
  }

  return {
    async acquire(ecosystem: Ecosystem): Promise<void> {
      const state = getWindow(ecosystem);
      const now = nowFn();

      pruneOld(state, now);

      if (state.timestamps.length < state.maxPerSecond) {
        state.timestamps.push(now);
        return;
      }

      // Calculate delay until the oldest timestamp exits the window
      const oldest = state.timestamps[0]!;
      const delayMs = oldest + 1000 - now;

      if (delayMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      }

      // Prune again after waiting
      pruneOld(state, nowFn());
      state.timestamps.push(nowFn());
    },

    reset(): void {
      windows.clear();
    },
  };
}
