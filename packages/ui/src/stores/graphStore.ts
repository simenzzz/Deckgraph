/**
 * Cross-language graph visualization state store.
 * Holds graph layout nodes/edges, selection, and filter state.
 */

import { create } from 'zustand';
import type { CrossEdgeType, Ecosystem } from '@deckgraph/shared';

export interface GraphLayoutNode {
  readonly id: string;
  readonly label: string;
  readonly ecosystem: Ecosystem;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface GraphLayoutEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly type: CrossEdgeType;
  readonly confidence: number;
  readonly evidence: string;
  readonly points: readonly { readonly x: number; readonly y: number }[];
}

export interface GraphState {
  readonly nodes: readonly GraphLayoutNode[];
  readonly edges: readonly GraphLayoutEdge[];
  readonly selectedNodeId: string | null;
  readonly selectedEdgeId: string | null;
  readonly edgeTypeFilter: ReadonlySet<CrossEdgeType>;
  readonly minConfidence: number;
}

export interface GraphActions {
  setGraph: (
    nodes: readonly GraphLayoutNode[],
    edges: readonly GraphLayoutEdge[],
  ) => void;
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  toggleEdgeType: (type: CrossEdgeType) => void;
  setMinConfidence: (value: number) => void;
  resetFilters: () => void;
}

export type GraphStore = GraphState & GraphActions;

const ALL_EDGE_TYPES: ReadonlySet<CrossEdgeType> = new Set<CrossEdgeType>([
  'proto',
  'openapi',
  'ffi',
  'build',
  'shared-config',
]);

const INITIAL_STATE: GraphState = {
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  edgeTypeFilter: ALL_EDGE_TYPES,
  minConfidence: 0,
};

export const useGraphStore = create<GraphStore>((set) => ({
  ...INITIAL_STATE,

  setGraph: (nodes, edges) =>
    set(() => ({
      nodes,
      edges,
      selectedNodeId: null,
      selectedEdgeId: null,
    })),

  selectNode: (id) =>
    set(() => ({ selectedNodeId: id, selectedEdgeId: null })),

  selectEdge: (id) =>
    set(() => ({ selectedEdgeId: id, selectedNodeId: null })),

  toggleEdgeType: (type) =>
    set((state) => {
      const next = new Set(state.edgeTypeFilter);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return { edgeTypeFilter: next };
    }),

  setMinConfidence: (value) =>
    set(() => ({ minConfidence: value })),

  resetFilters: () =>
    set(() => ({
      edgeTypeFilter: ALL_EDGE_TYPES,
      minConfidence: 0,
    })),
}));
