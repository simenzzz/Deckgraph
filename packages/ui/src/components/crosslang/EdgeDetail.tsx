/**
 * Detail panel for a selected cross-language edge.
 */

import type { GraphLayoutEdge } from '@/stores/graphStore';
import { Badge } from '@/components/ui/badge';

export interface EdgeDetailProps {
  readonly edge: GraphLayoutEdge | undefined;
}

export function EdgeDetail({ edge }: EdgeDetailProps) {
  if (!edge) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        Click an edge to see details.
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4 border rounded-md" data-testid="edge-detail">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Type:</span>
        <Badge variant="outline">{edge.type}</Badge>
      </div>
      <div className="text-sm">
        <span className="font-medium">From:</span>{' '}
        <span className="font-mono text-xs">{edge.from}</span>
      </div>
      <div className="text-sm">
        <span className="font-medium">To:</span>{' '}
        <span className="font-mono text-xs">{edge.to}</span>
      </div>
      <div className="text-sm">
        <span className="font-medium">Confidence:</span>{' '}
        <span className="font-mono">{Math.round(edge.confidence * 100)}%</span>
      </div>
      <div className="text-sm">
        <span className="font-medium">Evidence:</span>{' '}
        <span className="text-muted-foreground">{edge.evidence}</span>
      </div>
    </div>
  );
}
