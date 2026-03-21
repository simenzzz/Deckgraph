/**
 * Tests for cycle detection (Kahn's algorithm).
 */

import { describe, it, expect } from 'vitest';
import { detectCycles } from '../../graph/cycleDetector.js';

/**
 * Helper to build a forward adjacency map from an edge list.
 */
function buildForward(
  edges: readonly [string, string][],
): ReadonlyMap<string, ReadonlySet<string>> {
  const map = new Map<string, Set<string>>();
  for (const [from, to] of edges) {
    const existing = map.get(from);
    if (existing) {
      existing.add(to);
    } else {
      map.set(from, new Set([to]));
    }
  }
  return map;
}

describe('detectCycles', () => {
  it('handles an empty graph', () => {
    const result = detectCycles(new Map());

    expect(result.isAcyclic).toBe(true);
    expect(result.nodesInCycles).toEqual([]);
    expect(result.topologicalOrder).toEqual([]);
  });

  it('handles a linear chain (A → B → C)', () => {
    const forward = buildForward([
      ['A', 'B'],
      ['B', 'C'],
    ]);

    const result = detectCycles(forward);

    expect(result.isAcyclic).toBe(true);
    expect(result.nodesInCycles).toEqual([]);
    expect(result.topologicalOrder).toEqual(['A', 'B', 'C']);
  });

  it('detects a simple cycle (A → B → A)', () => {
    const forward = buildForward([
      ['A', 'B'],
      ['B', 'A'],
    ]);

    const result = detectCycles(forward);

    expect(result.isAcyclic).toBe(false);
    expect(result.nodesInCycles).toEqual(['A', 'B']);
  });

  it('detects a self-loop (A → A)', () => {
    const forward = buildForward([['A', 'A']]);

    const result = detectCycles(forward);

    expect(result.isAcyclic).toBe(false);
    expect(result.nodesInCycles).toEqual(['A']);
  });

  it('handles a diamond (no cycle: A → B, A → C, B → D, C → D)', () => {
    const forward = buildForward([
      ['A', 'B'],
      ['A', 'C'],
      ['B', 'D'],
      ['C', 'D'],
    ]);

    const result = detectCycles(forward);

    expect(result.isAcyclic).toBe(true);
    expect(result.nodesInCycles).toEqual([]);
    expect(result.topologicalOrder).toContain('A');
    expect(result.topologicalOrder).toContain('D');
    // A must come before B, C, and D
    expect(result.topologicalOrder.indexOf('A')).toBeLessThan(
      result.topologicalOrder.indexOf('D'),
    );
  });

  it('detects cycle in a larger graph', () => {
    // A → B → C → D → B (cycle: B, C, D)
    // A is not in the cycle
    const forward = buildForward([
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'D'],
      ['D', 'B'],
    ]);

    const result = detectCycles(forward);

    expect(result.isAcyclic).toBe(false);
    expect(result.nodesInCycles).toEqual(['B', 'C', 'D']);
    // A should be in topological order (not in cycle)
    expect(result.topologicalOrder).toContain('A');
  });

  it('handles disconnected components', () => {
    // Component 1: A → B
    // Component 2: C → D
    const forward = buildForward([
      ['A', 'B'],
      ['C', 'D'],
    ]);

    const result = detectCycles(forward);

    expect(result.isAcyclic).toBe(true);
    expect(result.topologicalOrder).toHaveLength(4);
  });

  it('handles multiple independent cycles', () => {
    // Cycle 1: A → B → A
    // Cycle 2: C → D → C
    const forward = buildForward([
      ['A', 'B'],
      ['B', 'A'],
      ['C', 'D'],
      ['D', 'C'],
    ]);

    const result = detectCycles(forward);

    expect(result.isAcyclic).toBe(false);
    expect(result.nodesInCycles).toEqual(['A', 'B', 'C', 'D']);
  });

  it('includes leaf nodes in topological order', () => {
    // A → B (B has no outgoing edges, only appears as target)
    const forward = buildForward([['A', 'B']]);

    const result = detectCycles(forward);

    expect(result.topologicalOrder).toContain('B');
    expect(result.topologicalOrder.indexOf('A')).toBeLessThan(
      result.topologicalOrder.indexOf('B'),
    );
  });
});
