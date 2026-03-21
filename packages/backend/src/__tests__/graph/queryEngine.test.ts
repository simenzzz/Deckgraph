/**
 * Tests for the query engine.
 */

import { describe, it, expect } from 'vitest';
import { executeQuery } from '../../graph/queryEngine.js';
import { buildGraph, emptyGraph } from '../../graph/dependencyGraph.js';
import {
  createTestModule,
  createTestDependency,
  createScopedDep,
  createConcernDep,
} from './fixtures.js';
import type { CrossEdge, UnifiedGraph, ViewQuery } from '@deckgraph/shared';

describe('executeQuery', () => {
  describe('empty query', () => {
    it('returns empty result for empty graph', () => {
      const result = executeQuery(emptyGraph(), {});

      expect(result.modules).toEqual([]);
      expect(result.crossEdges).toEqual([]);
      expect(result.summary.totalDeps).toBe(0);
      expect(result.summary.moduleCount).toBe(0);
    });

    it('returns all modules and deps for populated graph', () => {
      const mod = createTestModule({
        path: 'packages/app',
        dependencies: [
          createTestDependency({ name: 'react' }),
          createTestDependency({ name: 'lodash' }),
        ],
      });
      const graph = buildGraph([mod]);
      const result = executeQuery(graph, {});

      expect(result.modules).toHaveLength(1);
      expect(result.modules[0]!.dependencies).toHaveLength(2);
      expect(result.summary.totalDeps).toBe(2);
      expect(result.summary.moduleCount).toBe(1);
    });
  });

  describe('ecosystem filter', () => {
    it('includes only matching ecosystems', () => {
      const npmMod = createTestModule({
        path: 'packages/web',
        ecosystem: 'npm',
        dependencies: [createTestDependency({ name: 'react', ecosystem: 'npm' })],
      });
      const pyMod = createTestModule({
        path: 'services/api',
        ecosystem: 'pypi',
        dependencies: [createTestDependency({ name: 'flask', ecosystem: 'pypi' })],
      });
      const graph = buildGraph([npmMod, pyMod]);

      const result = executeQuery(graph, { ecosystems: ['npm'] });

      expect(result.modules).toHaveLength(1);
      expect(result.modules[0]!.ecosystem).toBe('npm');
    });

    it('supports multiple ecosystems', () => {
      const npmMod = createTestModule({ path: 'a', ecosystem: 'npm' });
      const pyMod = createTestModule({ path: 'b', ecosystem: 'pypi' });
      const goMod = createTestModule({ path: 'c', ecosystem: 'go' });
      const graph = buildGraph([npmMod, pyMod, goMod]);

      const result = executeQuery(graph, { ecosystems: ['npm', 'go'] });

      expect(result.modules).toHaveLength(2);
    });
  });

  describe('module path filter', () => {
    it('includes only matching module paths', () => {
      const mod1 = createTestModule({ path: 'packages/app', name: 'app' });
      const mod2 = createTestModule({ path: 'packages/lib', name: 'lib' });
      const graph = buildGraph([mod1, mod2]);

      const result = executeQuery(graph, { modules: ['packages/app'] });

      expect(result.modules).toHaveLength(1);
      expect(result.modules[0]!.path).toBe('packages/app');
    });
  });

  describe('scope filter', () => {
    it('filters deps by scope', () => {
      const mod = createTestModule({
        path: 'packages/app',
        dependencies: [
          createScopedDep('react', 'runtime'),
          createScopedDep('vitest', 'dev'),
          createScopedDep('esbuild', 'build'),
        ],
      });
      const graph = buildGraph([mod]);

      const result = executeQuery(graph, { scopes: ['runtime'] });

      expect(result.modules).toHaveLength(1);
      expect(result.modules[0]!.dependencies).toHaveLength(1);
      expect(result.modules[0]!.dependencies[0]!.name).toBe('react');
    });

    it('supports multiple scopes', () => {
      const mod = createTestModule({
        path: 'packages/app',
        dependencies: [
          createScopedDep('react', 'runtime'),
          createScopedDep('vitest', 'dev'),
          createScopedDep('esbuild', 'build'),
        ],
      });
      const graph = buildGraph([mod]);

      const result = executeQuery(graph, { scopes: ['runtime', 'dev'] });

      expect(result.modules[0]!.dependencies).toHaveLength(2);
    });

    it('excludes modules with 0 filtered deps', () => {
      const mod1 = createTestModule({
        path: 'packages/app',
        dependencies: [createScopedDep('react', 'runtime')],
      });
      const mod2 = createTestModule({
        path: 'packages/tools',
        name: 'tools',
        dependencies: [createScopedDep('esbuild', 'build')],
      });
      const graph = buildGraph([mod1, mod2]);

      const result = executeQuery(graph, { scopes: ['runtime'] });

      expect(result.modules).toHaveLength(1);
      expect(result.modules[0]!.path).toBe('packages/app');
    });
  });

  describe('concern filter', () => {
    it('filters deps by concern tag', () => {
      const mod = createTestModule({
        path: 'packages/app',
        dependencies: [
          createConcernDep('express', ['http', 'server']),
          createConcernDep('pg', ['database']),
          createConcernDep('lodash', ['utility']),
        ],
      });
      const graph = buildGraph([mod]);

      const result = executeQuery(graph, { concern: 'database' });

      expect(result.modules[0]!.dependencies).toHaveLength(1);
      expect(result.modules[0]!.dependencies[0]!.name).toBe('pg');
    });
  });

  describe('search filter', () => {
    it('finds exact matches', () => {
      const mod = createTestModule({
        path: 'packages/app',
        dependencies: [
          createTestDependency({ name: 'react' }),
          createTestDependency({ name: 'react-dom' }),
          createTestDependency({ name: 'lodash' }),
        ],
      });
      const graph = buildGraph([mod]);

      const result = executeQuery(graph, { search: 'react' });

      expect(result.modules[0]!.dependencies.length).toBeGreaterThanOrEqual(1);
      const names = result.modules[0]!.dependencies.map((d) => d.name);
      expect(names).toContain('react');
    });

    it('finds fuzzy matches', () => {
      const mod = createTestModule({
        path: 'packages/app',
        dependencies: [
          createTestDependency({ name: 'typescript' }),
          createTestDependency({ name: 'lodash' }),
        ],
      });
      const graph = buildGraph([mod]);

      // "typscript" is a typo for "typescript" — should fuzzy-match
      const result = executeQuery(graph, { search: 'typscript' });

      const names = result.modules[0]!.dependencies.map((d) => d.name);
      expect(names).toContain('typescript');
    });
  });

  describe('combined filters', () => {
    it('applies ecosystem + scope together', () => {
      const npmMod = createTestModule({
        path: 'packages/web',
        ecosystem: 'npm',
        dependencies: [
          createScopedDep('react', 'runtime', 'npm'),
          createScopedDep('vitest', 'dev', 'npm'),
        ],
      });
      const pyMod = createTestModule({
        path: 'services/api',
        ecosystem: 'pypi',
        dependencies: [
          createScopedDep('flask', 'runtime', 'pypi'),
        ],
      });
      const graph = buildGraph([npmMod, pyMod]);

      const result = executeQuery(graph, {
        ecosystems: ['npm'],
        scopes: ['runtime'],
      });

      expect(result.modules).toHaveLength(1);
      expect(result.modules[0]!.dependencies).toHaveLength(1);
      expect(result.modules[0]!.dependencies[0]!.name).toBe('react');
    });

    it('applies module + search together', () => {
      const mod1 = createTestModule({
        path: 'packages/app',
        name: 'app',
        dependencies: [
          createTestDependency({ name: 'react' }),
          createTestDependency({ name: 'lodash' }),
        ],
      });
      const mod2 = createTestModule({
        path: 'packages/lib',
        name: 'lib',
        dependencies: [
          createTestDependency({ name: 'react' }),
        ],
      });
      const graph = buildGraph([mod1, mod2]);

      const result = executeQuery(graph, {
        modules: ['packages/app'],
        search: 'react',
      });

      expect(result.modules).toHaveLength(1);
      expect(result.modules[0]!.path).toBe('packages/app');
      expect(result.modules[0]!.dependencies).toHaveLength(1);
    });
  });

  describe('cross-edge filtering', () => {
    function createGraphWithCrossEdges(): UnifiedGraph {
      const mod1 = createTestModule({ path: 'packages/web', ecosystem: 'npm' });
      const mod2 = createTestModule({ path: 'services/api', ecosystem: 'pypi' });
      const base = buildGraph([mod1, mod2]);

      const crossEdges: readonly CrossEdge[] = [
        {
          from: { module: 'packages/web', ecosystem: 'npm' },
          to: { module: 'services/api', ecosystem: 'pypi' },
          type: 'openapi',
          evidence: 'Shared OpenAPI spec',
          confidence: 0.8,
        },
        {
          from: { module: 'packages/web', ecosystem: 'npm' },
          to: { module: 'services/api', ecosystem: 'pypi' },
          type: 'proto',
          evidence: 'Shared .proto files',
          confidence: 0.9,
        },
      ];

      return { ...base, crossEdges };
    }

    it('excludes cross-edges when showCrossEdges is false', () => {
      const graph = createGraphWithCrossEdges();
      const result = executeQuery(graph, { showCrossEdges: false });

      expect(result.crossEdges).toEqual([]);
      expect(result.summary.crossEdgeCount).toBe(0);
    });

    it('excludes cross-edges by default (undefined)', () => {
      const graph = createGraphWithCrossEdges();
      const result = executeQuery(graph, {});

      expect(result.crossEdges).toEqual([]);
    });

    it('includes cross-edges when showCrossEdges is true', () => {
      const graph = createGraphWithCrossEdges();
      const result = executeQuery(graph, { showCrossEdges: true });

      expect(result.crossEdges.length).toBeGreaterThan(0);
    });

    it('filters cross-edges by type', () => {
      const graph = createGraphWithCrossEdges();
      const result = executeQuery(graph, {
        showCrossEdges: true,
        crossEdgeTypes: ['proto'],
      });

      expect(result.crossEdges).toHaveLength(1);
      expect(result.crossEdges[0]!.type).toBe('proto');
    });

    it('only includes cross-edges where both endpoints are in the view', () => {
      const graph = createGraphWithCrossEdges();
      // Filter to only npm modules — the pypi endpoint won't be in the view
      const result = executeQuery(graph, {
        ecosystems: ['npm'],
        showCrossEdges: true,
      });

      expect(result.crossEdges).toEqual([]);
    });
  });

  describe('totalDependencyCount', () => {
    it('preserves unfiltered dep count', () => {
      const mod = createTestModule({
        path: 'packages/app',
        dependencies: [
          createScopedDep('react', 'runtime'),
          createScopedDep('vitest', 'dev'),
          createScopedDep('esbuild', 'build'),
        ],
      });
      const graph = buildGraph([mod]);

      const result = executeQuery(graph, { scopes: ['runtime'] });

      expect(result.modules[0]!.dependencies).toHaveLength(1);
      expect(result.modules[0]!.totalDependencyCount).toBe(3);
    });
  });

  describe('ViewSummary', () => {
    it('computes correct ecosystem breakdown', () => {
      const mod1 = createTestModule({
        path: 'a',
        ecosystem: 'npm',
        dependencies: [
          createTestDependency({ name: 'react', ecosystem: 'npm' }),
          createTestDependency({ name: 'lodash', ecosystem: 'npm' }),
        ],
      });
      const mod2 = createTestModule({
        path: 'b',
        ecosystem: 'pypi',
        dependencies: [
          createTestDependency({ name: 'flask', ecosystem: 'pypi' }),
        ],
      });
      const graph = buildGraph([mod1, mod2]);

      const result = executeQuery(graph, {});

      expect(result.summary.byEcosystem.npm).toBe(2);
      expect(result.summary.byEcosystem.pypi).toBe(1);
      expect(result.summary.byEcosystem.cargo).toBe(0);
      expect(result.summary.byEcosystem.go).toBe(0);
      expect(result.summary.byEcosystem.maven).toBe(0);
    });

    it('computes correct scope breakdown', () => {
      const mod = createTestModule({
        path: 'a',
        dependencies: [
          createScopedDep('react', 'runtime'),
          createScopedDep('vitest', 'dev'),
        ],
      });
      const graph = buildGraph([mod]);

      const result = executeQuery(graph, {});

      expect(result.summary.byScope.runtime).toBe(1);
      expect(result.summary.byScope.dev).toBe(1);
      expect(result.summary.byScope.build).toBe(0);
      expect(result.summary.byScope.optional).toBe(0);
      expect(result.summary.byScope.peer).toBe(0);
    });

    it('has null outdatedCount and unusedCount', () => {
      const graph = buildGraph([createTestModule({ path: 'a' })]);
      const result = executeQuery(graph, {});

      expect(result.summary.outdatedCount).toBeNull();
      expect(result.summary.unusedCount).toBeNull();
    });

    it('initializes all ecosystem keys to 0', () => {
      const result = executeQuery(emptyGraph(), {});

      expect(result.summary.byEcosystem).toEqual({
        npm: 0,
        pypi: 0,
        cargo: 0,
        go: 0,
        maven: 0,
      });
    });

    it('initializes all scope keys to 0', () => {
      const result = executeQuery(emptyGraph(), {});

      expect(result.summary.byScope).toEqual({
        runtime: 0,
        dev: 0,
        build: 0,
        optional: 0,
        peer: 0,
      });
    });
  });
});
