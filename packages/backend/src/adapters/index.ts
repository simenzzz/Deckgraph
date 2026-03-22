/**
 * Default adapter registry with all built-in ecosystem adapters.
 */

import type { AdapterRegistry } from '@deckgraph/shared';
import { createAdapterRegistry } from './registry.js';
import type { RegistryCache } from './registryCache.js';
import type { RegistryRateLimiter } from './registryRateLimiter.js';
import { createJavaScriptAdapter } from './javascript/index.js';
import { createPythonAdapter } from './python/index.js';
import { createGoAdapter } from './go/index.js';
import { createRustAdapter } from './rust/index.js';
import { createJavaAdapter } from './java/index.js';

/**
 * Create an AdapterRegistry pre-loaded with all built-in adapters.
 * Includes: JavaScript/TypeScript (npm), Python (pypi), Go, Rust (cargo), Java (maven).
 *
 * @param cache - Optional registry cache (enables queryRegistry on all adapters)
 * @param rateLimiter - Optional rate limiter (required with cache)
 */
export function createDefaultRegistry(
  cache?: RegistryCache,
  rateLimiter?: RegistryRateLimiter,
): AdapterRegistry {
  const registry = createAdapterRegistry();
  registry.register(createJavaScriptAdapter(cache, rateLimiter));
  registry.register(createPythonAdapter(cache, rateLimiter));
  registry.register(createGoAdapter(cache, rateLimiter));
  registry.register(createRustAdapter(cache, rateLimiter));
  registry.register(createJavaAdapter(cache, rateLimiter));
  return registry;
}
