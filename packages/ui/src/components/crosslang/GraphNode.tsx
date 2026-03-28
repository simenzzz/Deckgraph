/**
 * SVG node for a module in the cross-language graph.
 * Colored by ecosystem, click to select.
 */

import { cn } from '@/lib/utils';
import type { GraphLayoutNode } from '@/stores/graphStore';

export interface GraphNodeProps {
  readonly node: GraphLayoutNode;
  readonly isSelected: boolean;
  readonly onSelect: (id: string) => void;
}

const ECOSYSTEM_FILL: Record<string, string> = {
  npm: '#e11d48',
  pypi: '#2563eb',
  cargo: '#d97706',
  go: '#0891b2',
  maven: '#7c3aed',
};

export function GraphNode({ node, isSelected, onSelect }: GraphNodeProps) {
  const fill = ECOSYSTEM_FILL[node.ecosystem] ?? '#6b7280';

  return (
    <g
      onClick={() => onSelect(node.id)}
      className="cursor-pointer"
      data-testid={`graph-node-${node.id}`}
    >
      <rect
        x={node.x - node.width / 2}
        y={node.y - node.height / 2}
        width={node.width}
        height={node.height}
        rx={8}
        fill={fill}
        fillOpacity={0.15}
        stroke={fill}
        strokeWidth={isSelected ? 3 : 1.5}
        className={cn(
          'transition-all',
          isSelected && 'drop-shadow-md',
        )}
      />
      <text
        x={node.x}
        y={node.y - 6}
        textAnchor="middle"
        className="fill-foreground text-xs font-medium"
      >
        {node.label}
      </text>
      <text
        x={node.x}
        y={node.y + 12}
        textAnchor="middle"
        className="fill-muted-foreground text-[10px]"
      >
        {node.ecosystem}
      </text>
    </g>
  );
}
