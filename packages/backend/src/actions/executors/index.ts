/**
 * Executor registry — maps ecosystems to their package management executors.
 */

import type { Ecosystem } from '@deckgraph/shared';
import type { EcosystemExecutor, ExecutorRegistry } from '../types.js';
import { createNpmExecutor } from './npmExecutor.js';
import { createPipExecutor } from './pipExecutor.js';
import { createGoExecutor } from './goExecutor.js';
import { createCargoExecutor } from './cargoExecutor.js';
import { createMavenExecutor } from './mavenExecutor.js';

/**
 * Create a registry containing executors for all supported ecosystems.
 */
export function createExecutorRegistry(): ExecutorRegistry {
  const executors: Array<[Ecosystem, EcosystemExecutor]> = [
    ['npm', createNpmExecutor()],
    ['pypi', createPipExecutor()],
    ['go', createGoExecutor()],
    ['cargo', createCargoExecutor()],
    ['maven', createMavenExecutor()],
  ];

  return new Map(executors);
}
