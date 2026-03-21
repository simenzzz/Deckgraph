/**
 * Default adapter registry with all built-in ecosystem adapters.
 */

import type { AdapterRegistry } from '@deckgraph/shared';
import { createAdapterRegistry } from './registry.js';
import { createJavaScriptAdapter } from './javascript/index.js';

/**
 * Create an AdapterRegistry pre-loaded with all built-in adapters.
 * Currently includes: JavaScript/TypeScript (npm).
 */
export function createDefaultRegistry(): AdapterRegistry {
  const registry = createAdapterRegistry();
  registry.register(createJavaScriptAdapter());
  return registry;
}
