/**
 * Tests for unified dependency graph construction.
 */

import { describe, it, expect } from 'vitest';
import {
  depKey,
  emptyGraph,
  buildGraph,
  addModule,
  removeModule,
} from '../../graph/dependencyGraph.js';
import { createTestModule, createTestDependency } from './fixtures.js';

describe('depKey', () => {
  it('formats as ecosystem:name', () => {
    expect(depKey('npm', 'react')).toBe('npm:react');
  });

  it('handles scoped npm packages', () => {
    expect(depKey('npm', '@babel/core')).toBe('npm:@babel/core');
  });

  it('handles go module paths', () => {
    expect(depKey('go', 'github.com/gin-gonic/gin')).toBe('go:github.com/gin-gonic/gin');
  });
});

describe('emptyGraph', () => {
  it('returns a graph with no modules', () => {
    const graph = emptyGraph();
    expect(graph.modules.size).toBe(0);
  });

  it('returns a graph with no forward edges', () => {
    const graph = emptyGraph();
    expect(graph.forward.size).toBe(0);
  });

  it('returns a graph with no reverse edges', () => {
    const graph = emptyGraph();
    expect(graph.reverse.size).toBe(0);
  });

  it('returns a graph with empty crossEdges', () => {
    const graph = emptyGraph();
    expect(graph.crossEdges).toEqual([]);
  });
});

describe('buildGraph', () => {
  it('handles empty input', () => {
    const graph = buildGraph([]);
    expect(graph.modules.size).toBe(0);
    expect(graph.forward.size).toBe(0);
    expect(graph.reverse.size).toBe(0);
  });

  it('builds a graph from a single module with no deps', () => {
    const mod = createTestModule({ path: 'packages/app', dependencies: [] });
    const graph = buildGraph([mod]);

    expect(graph.modules.size).toBe(1);
    expect(graph.modules.get('packages/app')).toBe(mod);
    expect(graph.forward.get('packages/app')?.size).toBe(0);
  });

  it('builds forward edges from module to deps', () => {
    const mod = createTestModule({
      path: 'packages/app',
      dependencies: [
        createTestDependency({ name: 'react' }),
        createTestDependency({ name: 'lodash' }),
      ],
    });
    const graph = buildGraph([mod]);

    const fwd = graph.forward.get('packages/app');
    expect(fwd).toBeDefined();
    expect(fwd!.has('npm:react')).toBe(true);
    expect(fwd!.has('npm:lodash')).toBe(true);
    expect(fwd!.size).toBe(2);
  });

  it('builds reverse edges from deps to modules', () => {
    const mod = createTestModule({
      path: 'packages/app',
      dependencies: [createTestDependency({ name: 'react' })],
    });
    const graph = buildGraph([mod]);

    const rev = graph.reverse.get('npm:react');
    expect(rev).toBeDefined();
    expect(rev!.has('packages/app')).toBe(true);
  });

  it('handles multiple modules sharing a dependency', () => {
    const mod1 = createTestModule({
      path: 'packages/app',
      name: 'app',
      dependencies: [createTestDependency({ name: 'zod' })],
    });
    const mod2 = createTestModule({
      path: 'packages/lib',
      name: 'lib',
      dependencies: [createTestDependency({ name: 'zod' })],
    });
    const graph = buildGraph([mod1, mod2]);

    const rev = graph.reverse.get('npm:zod');
    expect(rev).toBeDefined();
    expect(rev!.has('packages/app')).toBe(true);
    expect(rev!.has('packages/lib')).toBe(true);
    expect(rev!.size).toBe(2);
  });

  it('handles multiple ecosystems', () => {
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

    expect(graph.modules.size).toBe(2);
    expect(graph.forward.get('packages/web')!.has('npm:react')).toBe(true);
    expect(graph.forward.get('services/api')!.has('pypi:flask')).toBe(true);
  });

  it('always returns empty crossEdges', () => {
    const mod = createTestModule({
      path: 'packages/app',
      dependencies: [createTestDependency({ name: 'react' })],
    });
    const graph = buildGraph([mod]);
    expect(graph.crossEdges).toEqual([]);
  });

  it('handles large module count', () => {
    const modules = Array.from({ length: 100 }, (_, i) =>
      createTestModule({
        path: `packages/mod-${i}`,
        name: `mod-${i}`,
        dependencies: [createTestDependency({ name: `dep-${i}` })],
      }),
    );
    const graph = buildGraph(modules);

    expect(graph.modules.size).toBe(100);
    expect(graph.forward.size).toBe(100);
  });
});

describe('addModule', () => {
  it('adds a module to an empty graph', () => {
    const graph = emptyGraph();
    const mod = createTestModule({
      path: 'packages/new',
      dependencies: [createTestDependency({ name: 'react' })],
    });

    const updated = addModule(graph, mod);

    expect(updated.modules.size).toBe(1);
    expect(updated.modules.get('packages/new')).toEqual(mod);
    expect(updated.forward.get('packages/new')!.has('npm:react')).toBe(true);
  });

  it('replaces an existing module at the same path', () => {
    const mod1 = createTestModule({
      path: 'packages/app',
      dependencies: [createTestDependency({ name: 'react' })],
    });
    const graph = buildGraph([mod1]);

    const mod2 = createTestModule({
      path: 'packages/app',
      dependencies: [createTestDependency({ name: 'vue' })],
    });
    const updated = addModule(graph, mod2);

    expect(updated.modules.size).toBe(1);
    expect(updated.forward.get('packages/app')!.has('npm:vue')).toBe(true);
    expect(updated.forward.get('packages/app')!.has('npm:react')).toBe(false);
  });

  it('does not mutate the original graph', () => {
    const graph = emptyGraph();
    const mod = createTestModule({ path: 'packages/new' });

    const updated = addModule(graph, mod);

    expect(graph.modules.size).toBe(0);
    expect(updated.modules.size).toBe(1);
  });
});

describe('removeModule', () => {
  it('removes an existing module', () => {
    const mod1 = createTestModule({ path: 'packages/a', name: 'a' });
    const mod2 = createTestModule({ path: 'packages/b', name: 'b' });
    const graph = buildGraph([mod1, mod2]);

    const updated = removeModule(graph, 'packages/a');

    expect(updated.modules.size).toBe(1);
    expect(updated.modules.has('packages/a')).toBe(false);
    expect(updated.modules.has('packages/b')).toBe(true);
  });

  it('returns the same graph when path does not exist', () => {
    const mod = createTestModule({ path: 'packages/a' });
    const graph = buildGraph([mod]);

    const updated = removeModule(graph, 'packages/nonexistent');

    expect(updated).toBe(graph);
  });

  it('cleans up reverse edges for removed module', () => {
    const mod = createTestModule({
      path: 'packages/only',
      dependencies: [createTestDependency({ name: 'react' })],
    });
    const graph = buildGraph([mod]);

    const updated = removeModule(graph, 'packages/only');

    expect(updated.reverse.has('npm:react')).toBe(false);
  });

  it('does not mutate the original graph', () => {
    const mod = createTestModule({ path: 'packages/a' });
    const graph = buildGraph([mod]);

    const updated = removeModule(graph, 'packages/a');

    expect(graph.modules.size).toBe(1);
    expect(updated.modules.size).toBe(0);
  });

  it('preserves crossEdges', () => {
    const mod = createTestModule({ path: 'packages/a', name: 'a' });
    const graph = buildGraph([mod]);
    const crossEdges = [
      {
        from: { module: 'packages/a', ecosystem: 'npm' as const },
        to: { module: 'packages/b', ecosystem: 'pypi' as const },
        type: 'openapi' as const,
        evidence: 'test',
        confidence: 0.8,
      },
    ];
    const graphWithEdges = { ...graph, crossEdges };

    const updated = removeModule(graphWithEdges, 'packages/a');

    expect(updated.crossEdges).toEqual(crossEdges);
  });
});

describe('addModule preserves crossEdges', () => {
  it('keeps crossEdges when adding a module', () => {
    const mod = createTestModule({ path: 'packages/a', name: 'a' });
    const graph = buildGraph([mod]);
    const crossEdges = [
      {
        from: { module: 'packages/a', ecosystem: 'npm' as const },
        to: { module: 'packages/b', ecosystem: 'pypi' as const },
        type: 'ffi' as const,
        evidence: 'test',
        confidence: 0.9,
      },
    ];
    const graphWithEdges = { ...graph, crossEdges };

    const newMod = createTestModule({ path: 'packages/c', name: 'c' });
    const updated = addModule(graphWithEdges, newMod);

    expect(updated.crossEdges).toEqual(crossEdges);
    expect(updated.modules.size).toBe(2);
  });
});
