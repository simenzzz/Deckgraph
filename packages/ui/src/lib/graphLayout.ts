/**
 * Graph layout computation using dagre.
 *
 * Pure function: takes modules + cross-edges + filters, returns positioned
 * nodes and edges. Only includes modules that participate in at least one
 * visible cross-edge.
 */

import dagre from 'dagre';
import type { CrossEdge, CrossEdgeType, Module } from '@deckgraph/shared';
import type { GraphLayoutNode, GraphLayoutEdge } from '@/stores/graphStore';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;
const GRAPH_DIRECTION = 'LR';
const NODE_SEP = 60;
const RANK_SEP = 120;

export interface GraphLayoutInput {
  readonly modules: readonly Module[];
  readonly crossEdges: readonly CrossEdge[];
  readonly edgeTypeFilter: ReadonlySet<CrossEdgeType>;
  readonly minConfidence: number;
}

export interface GraphLayoutResult {
  readonly nodes: readonly GraphLayoutNode[];
  readonly edges: readonly GraphLayoutEdge[];
}

/**
 * Compute graph layout for cross-language edges.
 *
 * 1. Filter edges by type and confidence
 * 2. Collect participating modules
 * 3. Run dagre layout
 * 4. Extract positioned nodes and edge points
 */
export function computeGraphLayout(input: GraphLayoutInput): GraphLayoutResult {
  const { modules, crossEdges, edgeTypeFilter, minConfidence } = input;

  const filteredEdges = crossEdges.filter(
    (edge) =>
      edgeTypeFilter.has(edge.type) && edge.confidence >= minConfidence,
  );

  if (filteredEdges.length === 0) {
    return { nodes: [], edges: [] };
  }

  const participatingModules = new Set<string>();
  for (const edge of filteredEdges) {
    participatingModules.add(edge.from.module);
    participatingModules.add(edge.to.module);
  }

  const moduleMap = new Map<string, Module>();
  for (const mod of modules) {
    if (participatingModules.has(mod.path)) {
      moduleMap.set(mod.path, mod);
    }
  }

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: GRAPH_DIRECTION,
    nodesep: NODE_SEP,
    ranksep: RANK_SEP,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const [path, mod] of moduleMap) {
    g.setNode(path, {
      label: mod.name,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });
  }

  for (const edge of filteredEdges) {
    const edgeId = `${edge.from.module}|${edge.to.module}|${edge.type}`;
    g.setEdge(edge.from.module, edge.to.module, { id: edgeId });
  }

  dagre.layout(g);

  const nodes: GraphLayoutNode[] = [];
  for (const nodeId of g.nodes()) {
    const nodeData = g.node(nodeId);
    const mod = moduleMap.get(nodeId);
    if (!nodeData || !mod) continue;

    nodes.push({
      id: nodeId,
      label: mod.name,
      ecosystem: mod.ecosystem,
      x: nodeData.x,
      y: nodeData.y,
      width: nodeData.width,
      height: nodeData.height,
    });
  }

  const edges: GraphLayoutEdge[] = filteredEdges.map((edge) => {
    const edgeId = `${edge.from.module}|${edge.to.module}|${edge.type}`;
    const dagreEdge = g.edge(edge.from.module, edge.to.module);
    const points: { readonly x: number; readonly y: number }[] =
      dagreEdge?.points ?? [];

    return {
      id: edgeId,
      from: edge.from.module,
      to: edge.to.module,
      type: edge.type,
      confidence: edge.confidence,
      evidence: edge.evidence,
      points,
    };
  });

  return { nodes, edges };
}
