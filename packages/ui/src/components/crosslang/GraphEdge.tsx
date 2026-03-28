/**
 * SVG path for a cross-language edge.
 * Width proportional to confidence, colored by type.
 */

import type { GraphLayoutEdge } from '@/stores/graphStore';

export interface GraphEdgeProps {
  readonly edge: GraphLayoutEdge;
  readonly isSelected: boolean;
  readonly onSelect: (id: string) => void;
}

const TYPE_COLORS: Record<string, string> = {
  proto: '#7c3aed',
  ffi: '#ea580c',
  openapi: '#0d9488',
  build: '#6b7280',
  'shared-config': '#ca8a04',
};

function pointsToPath(
  points: readonly { readonly x: number; readonly y: number }[],
): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  return `M ${first.x} ${first.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(' ')}`;
}

export function GraphEdge({ edge, isSelected, onSelect }: GraphEdgeProps) {
  const color = TYPE_COLORS[edge.type] ?? '#6b7280';
  const strokeWidth = 1 + edge.confidence * 3;

  return (
    <g
      onClick={() => onSelect(edge.id)}
      className="cursor-pointer"
      data-testid={`graph-edge-${edge.id}`}
    >
      <path
        d={pointsToPath(edge.points)}
        fill="none"
        stroke={color}
        strokeWidth={isSelected ? strokeWidth + 2 : strokeWidth}
        strokeOpacity={isSelected ? 1 : 0.6}
        markerEnd="url(#arrowhead)"
      />
    </g>
  );
}
