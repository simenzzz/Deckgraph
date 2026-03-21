/**
 * Cross-language edge list table.
 * Shows from/to modules with ecosystem badges, type, confidence, and evidence.
 */

import type { CrossEdge } from '@deckgraph/shared';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export interface CrossEdgeListProps {
  readonly crossEdges: readonly CrossEdge[];
}

const TYPE_STYLES: Record<string, string> = {
  proto: 'bg-violet-100 text-violet-800 border-violet-300',
  ffi: 'bg-orange-100 text-orange-800 border-orange-300',
  openapi: 'bg-teal-100 text-teal-800 border-teal-300',
  build: 'bg-gray-100 text-gray-700 border-gray-300',
  'shared-config': 'bg-yellow-100 text-yellow-800 border-yellow-300',
};

export function CrossEdgeList({ crossEdges }: CrossEdgeListProps) {
  if (crossEdges.length === 0) {
    return (
      <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
        No cross-language edges detected.
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
        {crossEdges.map((edge) => (
          <TableRow key={`${edge.from.module}-${edge.to.module}-${edge.type}`}>
            <TableCell className="text-xs">
              <span className="font-medium">{edge.from.module}</span>
              <Badge variant="outline" className="ml-1 text-[10px]">
                {edge.from.ecosystem}
              </Badge>
            </TableCell>
            <TableCell className="text-xs">
              <span className="font-medium">{edge.to.module}</span>
              <Badge variant="outline" className="ml-1 text-[10px]">
                {edge.to.ecosystem}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className={TYPE_STYLES[edge.type] ?? ''}
              >
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
