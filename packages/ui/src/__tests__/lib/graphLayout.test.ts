import { describe, it, expect } from 'vitest';
import { computeGraphLayout } from '../../lib/graphLayout';
import type { CrossEdge, Module } from '@deckgraph/shared';

function makeModule(path: string, name: string, ecosystem: 'npm' | 'pypi' | 'cargo' | 'go' | 'maven'): Module {
  return {
    path,
    name,
    ecosystem,
    manifests: [`${path}/package.json`],
    dependencies: [],
    analysisState: 'manifest-only',
  };
}

function makeCrossEdge(
  fromModule: string,
  fromEcosystem: 'npm' | 'pypi' | 'cargo' | 'go' | 'maven',
  toModule: string,
  toEcosystem: 'npm' | 'pypi' | 'cargo' | 'go' | 'maven',
  type: 'proto' | 'openapi' | 'ffi' | 'build' | 'shared-config' = 'proto',
  confidence = 0.8,
): CrossEdge {
  return {
    from: { module: fromModule, ecosystem: fromEcosystem },
    to: { module: toModule, ecosystem: toEcosystem },
    type,
    evidence: `${type} detection`,
    confidence,
  };
}

describe('computeGraphLayout', () => {
  const modules: Module[] = [
    makeModule('services/api', 'api-gateway', 'npm'),
    makeModule('services/auth', 'auth-service', 'pypi'),
    makeModule('services/pay', 'payment-processor', 'go'),
    makeModule('libs/types', 'shared-types', 'npm'),
  ];

  const crossEdges: CrossEdge[] = [
    makeCrossEdge('services/api', 'npm', 'services/auth', 'pypi', 'proto', 0.8),
    makeCrossEdge('services/api', 'npm', 'services/pay', 'go', 'openapi', 0.7),
    makeCrossEdge('services/auth', 'pypi', 'services/pay', 'go', 'ffi', 0.5),
  ];

  const allTypes = new Set<'proto' | 'openapi' | 'ffi' | 'build' | 'shared-config'>([
    'proto', 'openapi', 'ffi', 'build', 'shared-config',
  ]);

  it('should return positioned nodes for modules with edges', () => {
    const result = computeGraphLayout({
      modules,
      crossEdges,
      edgeTypeFilter: allTypes,
      minConfidence: 0,
    });

    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(3);

    for (const node of result.nodes) {
      expect(typeof node.x).toBe('number');
      expect(typeof node.y).toBe('number');
      expect(node.width).toBeGreaterThan(0);
      expect(node.height).toBeGreaterThan(0);
    }
  });

  it('should exclude modules with no cross-edges', () => {
    const result = computeGraphLayout({
      modules,
      crossEdges,
      edgeTypeFilter: allTypes,
      minConfidence: 0,
    });

    const nodeIds = result.nodes.map((n) => n.id);
    expect(nodeIds).not.toContain('libs/types');
  });

  it('should filter edges by type', () => {
    const result = computeGraphLayout({
      modules,
      crossEdges,
      edgeTypeFilter: new Set(['proto'] as const),
      minConfidence: 0,
    });

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].type).toBe('proto');
    expect(result.nodes).toHaveLength(2);
  });

  it('should filter edges by confidence', () => {
    const result = computeGraphLayout({
      modules,
      crossEdges,
      edgeTypeFilter: allTypes,
      minConfidence: 0.6,
    });

    expect(result.edges).toHaveLength(2);
    for (const edge of result.edges) {
      expect(edge.confidence).toBeGreaterThanOrEqual(0.6);
    }
  });

  it('should return empty result when no edges pass filters', () => {
    const result = computeGraphLayout({
      modules,
      crossEdges,
      edgeTypeFilter: new Set(['build'] as const),
      minConfidence: 0,
    });

    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it('should return empty result for empty inputs', () => {
    const result = computeGraphLayout({
      modules: [],
      crossEdges: [],
      edgeTypeFilter: allTypes,
      minConfidence: 0,
    });

    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it('should include edge points from dagre', () => {
    const result = computeGraphLayout({
      modules,
      crossEdges: [crossEdges[0]],
      edgeTypeFilter: allTypes,
      minConfidence: 0,
    });

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].points.length).toBeGreaterThan(0);
    for (const point of result.edges[0].points) {
      expect(typeof point.x).toBe('number');
      expect(typeof point.y).toBe('number');
    }
  });

  it('should preserve ecosystem from module data', () => {
    const result = computeGraphLayout({
      modules,
      crossEdges,
      edgeTypeFilter: allTypes,
      minConfidence: 0,
    });

    const apiNode = result.nodes.find((n) => n.id === 'services/api');
    const authNode = result.nodes.find((n) => n.id === 'services/auth');
    expect(apiNode?.ecosystem).toBe('npm');
    expect(authNode?.ecosystem).toBe('pypi');
  });
});
