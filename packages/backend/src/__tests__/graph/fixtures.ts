/**
 * Test fixtures and factory functions for graph tests.
 */

import type { Dependency, Ecosystem, Module, DependencyScope, AnalysisState } from '@deckgraph/shared';

/**
 * Create a test dependency with sensible defaults.
 */
export function createTestDependency(
  overrides: Partial<Dependency> = {},
): Dependency {
  return {
    name: 'test-dep',
    ecosystem: 'npm',
    version: '1.0.0',
    constraint: '^1.0.0',
    scope: 'runtime',
    source: 'manifest',
    concerns: [],
    usedInFiles: null,
    transitiveDeps: null,
    registryMeta: null,
    ...overrides,
  };
}

/**
 * Create a test module with sensible defaults.
 */
export function createTestModule(
  overrides: Partial<Module> & { path?: string } = {},
): Module {
  return {
    path: 'packages/test',
    name: 'test-module',
    ecosystem: 'npm' as Ecosystem,
    manifests: ['package.json'],
    dependencies: [],
    analysisState: 'manifest-only' as AnalysisState,
    ...overrides,
  };
}

/**
 * Create a dependency with a specific scope for filter testing.
 */
export function createScopedDep(
  name: string,
  scope: DependencyScope,
  ecosystem: Ecosystem = 'npm',
): Dependency {
  return createTestDependency({ name, scope, ecosystem });
}

/**
 * Create a dependency with concern tags for filter testing.
 */
export function createConcernDep(
  name: string,
  concerns: readonly string[],
): Dependency {
  return createTestDependency({ name, concerns });
}
