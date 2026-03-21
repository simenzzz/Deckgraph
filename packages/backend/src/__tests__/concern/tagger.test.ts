/**
 * Tests for the concern tagger.
 */

import { describe, it, expect } from 'vitest';
import { tagDependencies } from '../../concern/tagger.js';
import type { Dependency, Module, ProjectConfig } from '@deckgraph/shared';

function makeDep(overrides: Partial<Dependency> = {}): Dependency {
  return {
    name: 'test-pkg',
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

function makeModule(deps: readonly Dependency[], overrides: Partial<Module> = {}): Module {
  return {
    path: 'packages/app',
    name: 'app',
    ecosystem: 'npm',
    manifests: ['package.json'],
    dependencies: deps,
    analysisState: 'manifest-only',
    ...overrides,
  };
}

describe('tagDependencies', () => {
  it('looks up known packages in the built-in database', () => {
    const modules = [makeModule([makeDep({ name: 'express' })])];
    const result = tagDependencies(modules, null);

    expect(result[0]!.dependencies[0]!.concerns).toContain('http');
    expect(result[0]!.dependencies[0]!.concerns).toContain('server');
  });

  it('returns empty concerns for unknown packages', () => {
    const modules = [makeModule([makeDep({ name: 'my-custom-pkg' })])];
    const result = tagDependencies(modules, null);

    expect(result[0]!.dependencies[0]!.concerns).toEqual([]);
  });

  it('merges user override tags with built-in tags', () => {
    const config: ProjectConfig = {
      ignorePaths: [],
      concernOverrides: { express: ['custom-tag'] },
    };
    const modules = [makeModule([makeDep({ name: 'express' })])];
    const result = tagDependencies(modules, config);

    const concerns = result[0]!.dependencies[0]!.concerns;
    expect(concerns).toContain('http');
    expect(concerns).toContain('server');
    expect(concerns).toContain('custom-tag');
  });

  it('applies user overrides even for unknown packages', () => {
    const config: ProjectConfig = {
      ignorePaths: [],
      concernOverrides: { 'my-pkg': ['database'] },
    };
    const modules = [makeModule([makeDep({ name: 'my-pkg' })])];
    const result = tagDependencies(modules, config);

    expect(result[0]!.dependencies[0]!.concerns).toEqual(['database']);
  });

  it('deduplicates tags when override matches built-in', () => {
    const config: ProjectConfig = {
      ignorePaths: [],
      concernOverrides: { express: ['http'] },
    };
    const modules = [makeModule([makeDep({ name: 'express' })])];
    const result = tagDependencies(modules, config);

    const concerns = result[0]!.dependencies[0]!.concerns;
    const httpCount = concerns.filter((c) => c === 'http').length;
    expect(httpCount).toBe(1);
  });

  it('does not mutate original modules', () => {
    const dep = makeDep({ name: 'express' });
    const mod = makeModule([dep]);
    const modules = [mod];
    const result = tagDependencies(modules, null);

    // Original should be unchanged
    expect(mod.dependencies[0]!.concerns).toEqual([]);
    // Result should have tags
    expect(result[0]!.dependencies[0]!.concerns.length).toBeGreaterThan(0);
    // Result should be a different reference
    expect(result[0]).not.toBe(mod);
    expect(result[0]!.dependencies[0]).not.toBe(dep);
  });

  it('handles multiple modules and dependencies', () => {
    const modules = [
      makeModule([
        makeDep({ name: 'express' }),
        makeDep({ name: 'vitest', scope: 'dev' }),
      ]),
      makeModule(
        [makeDep({ name: 'django', ecosystem: 'pypi' })],
        { path: 'services/api', ecosystem: 'pypi' },
      ),
    ];

    const result = tagDependencies(modules, null);

    expect(result).toHaveLength(2);
    expect(result[0]!.dependencies[0]!.concerns).toContain('http');
    expect(result[0]!.dependencies[1]!.concerns).toContain('testing');
    expect(result[1]!.dependencies[0]!.concerns).toContain('http');
  });

  it('handles null config', () => {
    const modules = [makeModule([makeDep({ name: 'express' })])];
    const result = tagDependencies(modules, null);

    expect(result[0]!.dependencies[0]!.concerns).toContain('http');
  });

  it('handles empty modules array', () => {
    const result = tagDependencies([], null);
    expect(result).toEqual([]);
  });
});
