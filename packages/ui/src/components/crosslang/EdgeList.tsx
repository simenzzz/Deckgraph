/**
 * Table of filtered cross-language edges below the graph.
 */

import type { GraphLayoutEdge } from '@/stores/graphStore';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface EdgeListProps {
  readonly edges: readonly GraphLayoutEdge[];
  readonly selectedEdgeId: string | null;
  readonly onSelectEdge: (id: string) => void;
}

const TYPE_STYLES: Record<string, string> = {
  proto: 'bg-violet-100 text-violet-800 border-violet-300',
  ffi: 'bg-orange-100 text-orange-800 border-orange-300',
  openapi: 'bg-teal-100 text-teal-800 border-teal-300',
  build: 'bg-gray-100 text-gray-700 border-gray-300',
  'shared-config': 'bg-yellow-100 text-yellow-800 border-yellow-300',
};

export function EdgeList({ edges, selectedEdgeId, onSelectEdge }: EdgeListProps) {
  if (edges.length === 0) {
    return (
      <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
        No cross-language edges match the current filters.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>From</TableHead>
          <TableHead>To</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Confidence</TableHead>
          <TableHead>Evidence</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {edges.map((edge) => (
          <TableRow
            key={edge.id}
            onClick={() => onSelectEdge(edge.id)}
            className={cn(
              'cursor-pointer',
              selectedEdgeId === edge.id && 'bg-accent',
            )}
            data-testid={`edge-row-${edge.id}`}
          >
            <TableCell className="text-xs font-medium">{edge.from}</TableCell>
            <TableCell className="text-xs font-medium">{edge.to}</TableCell>
            <TableCell>
              <Badge variant="outline" className={TYPE_STYLES[edge.type] ?? ''}>
                {edge.type}
              </Badge>
            </TableCell>
            <TableCell className="font-mono text-xs">
              {Math.round(edge.confidence * 100)}%
            </TableCell>
            <TableCell className="max-w-[300px] truncate text-xs text-muted-foreground">
              {edge.evidence}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
