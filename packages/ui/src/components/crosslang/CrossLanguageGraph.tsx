/**
 * Top-level cross-language graph view.
 * Orchestrates layout computation, filtering, and graph rendering.
 */

import { useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useGraphStore } from '@/stores/graphStore';
import { computeGraphLayout } from '@/lib/graphLayout';
import { GraphCanvas } from './GraphCanvas';
import { GraphNode } from './GraphNode';
import { GraphEdge } from './GraphEdge';
import { CrossEdgeFilter } from './CrossEdgeFilter';
import { EdgeList } from './EdgeList';
import { EdgeDetail } from './EdgeDetail';

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 500;

export function CrossLanguageGraph() {
  const project = useProjectStore((s) => s.project);
  const edgeTypeFilter = useGraphStore((s) => s.edgeTypeFilter);
  const minConfidence = useGraphStore((s) => s.minConfidence);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const selectedEdgeId = useGraphStore((s) => s.selectedEdgeId);
  const selectNode = useGraphStore((s) => s.selectNode);
  const selectEdge = useGraphStore((s) => s.selectEdge);
  const toggleEdgeType = useGraphStore((s) => s.toggleEdgeType);
  const setMinConfidence = useGraphStore((s) => s.setMinConfidence);

  const layout = useMemo(() => {
    if (!project) return { nodes: [], edges: [] };
    return computeGraphLayout({
      modules: project.modules,
      crossEdges: project.crossEdges,
      edgeTypeFilter,
      minConfidence,
    });
  }, [project, edgeTypeFilter, minConfidence]);

  const selectedEdge = useMemo(
    () => layout.edges.find((e) => e.id === selectedEdgeId),
    [layout.edges, selectedEdgeId],
  );

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Scan a project to view cross-language connections.
      </div>
    );
  }

  if (project.crossEdges.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No cross-language edges detected in this project.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="cross-language-graph">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Cross-Language Dependencies</h2>
      </div>

      <CrossEdgeFilter
        edgeTypeFilter={edgeTypeFilter}
        minConfidence={minConfidence}
        onToggleType={toggleEdgeType}
        onConfidenceChange={setMinConfidence}
      />

      <GraphCanvas width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
        {layout.edges.map((edge) => (
          <GraphEdge
            key={edge.id}
            edge={edge}
            isSelected={selectedEdgeId === edge.id}
            onSelect={selectEdge}
          />
        ))}
        {layout.nodes.map((node) => (
          <GraphNode
            key={node.id}
            node={node}
            isSelected={selectedNodeId === node.id}
            onSelect={selectNode}
          />
        ))}
      </GraphCanvas>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <EdgeList
            edges={layout.edges}
            selectedEdgeId={selectedEdgeId}
            onSelectEdge={selectEdge}
          />
        </div>
        <EdgeDetail edge={selectedEdge} />
      </div>
    </div>
  );
}
