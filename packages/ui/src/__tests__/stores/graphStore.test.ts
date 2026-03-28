import { describe, it, expect, beforeEach } from 'vitest';
import { useGraphStore } from '../../stores/graphStore';
import type { GraphLayoutNode, GraphLayoutEdge } from '../../stores/graphStore';

function makeNode(id: string): GraphLayoutNode {
  return {
    id,
    label: id,
    ecosystem: 'npm',
    x: 0,
    y: 0,
    width: 180,
    height: 60,
  };
}

function makeEdge(from: string, to: string): GraphLayoutEdge {
  return {
    id: `${from}|${to}|proto`,
    from,
    to,
    type: 'proto',
    confidence: 0.8,
    evidence: 'test evidence',
    points: [{ x: 0, y: 0 }],
  };
}

describe('graphStore', () => {
  beforeEach(() => {
    useGraphStore.setState({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      selectedEdgeId: null,
      edgeTypeFilter: new Set(['proto', 'openapi', 'ffi', 'build', 'shared-config']),
      minConfidence: 0,
    });
  });

  describe('setGraph', () => {
    it('should set nodes and edges', () => {
      const nodes = [makeNode('a'), makeNode('b')];
      const edges = [makeEdge('a', 'b')];

      useGraphStore.getState().setGraph(nodes, edges);
      const state = useGraphStore.getState();

      expect(state.nodes).toEqual(nodes);
      expect(state.edges).toEqual(edges);
    });

    it('should clear selection when setting graph', () => {
      useGraphStore.setState({ selectedNodeId: 'a', selectedEdgeId: 'e1' });
      useGraphStore.getState().setGraph([], []);
      const state = useGraphStore.getState();

      expect(state.selectedNodeId).toBeNull();
      expect(state.selectedEdgeId).toBeNull();
    });
  });

  describe('selectNode', () => {
    it('should select a node and clear edge selection', () => {
      useGraphStore.setState({ selectedEdgeId: 'e1' });
      useGraphStore.getState().selectNode('node1');
      const state = useGraphStore.getState();

      expect(state.selectedNodeId).toBe('node1');
      expect(state.selectedEdgeId).toBeNull();
    });

    it('should allow deselecting by passing null', () => {
      useGraphStore.setState({ selectedNodeId: 'node1' });
      useGraphStore.getState().selectNode(null);

      expect(useGraphStore.getState().selectedNodeId).toBeNull();
    });
  });

  describe('selectEdge', () => {
    it('should select an edge and clear node selection', () => {
      useGraphStore.setState({ selectedNodeId: 'node1' });
      useGraphStore.getState().selectEdge('edge1');
      const state = useGraphStore.getState();

      expect(state.selectedEdgeId).toBe('edge1');
      expect(state.selectedNodeId).toBeNull();
    });
  });

  describe('toggleEdgeType', () => {
    it('should remove type when present', () => {
      useGraphStore.getState().toggleEdgeType('proto');
      const filter = useGraphStore.getState().edgeTypeFilter;

      expect(filter.has('proto')).toBe(false);
      expect(filter.has('openapi')).toBe(true);
    });

    it('should add type when absent', () => {
      useGraphStore.getState().toggleEdgeType('proto');
      useGraphStore.getState().toggleEdgeType('proto');
      const filter = useGraphStore.getState().edgeTypeFilter;

      expect(filter.has('proto')).toBe(true);
    });
  });

  describe('setMinConfidence', () => {
    it('should update min confidence', () => {
      useGraphStore.getState().setMinConfidence(0.5);
      expect(useGraphStore.getState().minConfidence).toBe(0.5);
    });
  });

  describe('resetFilters', () => {
    it('should reset edge type filter and confidence', () => {
      useGraphStore.getState().toggleEdgeType('proto');
      useGraphStore.getState().setMinConfidence(0.7);
      useGraphStore.getState().resetFilters();
      const state = useGraphStore.getState();

      expect(state.edgeTypeFilter.size).toBe(5);
      expect(state.minConfidence).toBe(0);
    });
  });
});
