/**
 * Filter controls for cross-language edge types and confidence threshold.
 */

import type { CrossEdgeType } from '@deckgraph/shared';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface CrossEdgeFilterProps {
  readonly edgeTypeFilter: ReadonlySet<CrossEdgeType>;
  readonly minConfidence: number;
  readonly onToggleType: (type: CrossEdgeType) => void;
  readonly onConfidenceChange: (value: number) => void;
}

const EDGE_TYPES: readonly { readonly type: CrossEdgeType; readonly label: string; readonly className: string }[] = [
  { type: 'proto', label: 'Proto/gRPC', className: 'bg-violet-100 text-violet-800 border-violet-300' },
  { type: 'ffi', label: 'FFI', className: 'bg-orange-100 text-orange-800 border-orange-300' },
  { type: 'openapi', label: 'OpenAPI', className: 'bg-teal-100 text-teal-800 border-teal-300' },
  { type: 'build', label: 'Build Refs', className: 'bg-gray-100 text-gray-700 border-gray-300' },
  { type: 'shared-config', label: 'Shared Config', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
];

export function CrossEdgeFilter({
  edgeTypeFilter,
  minConfidence,
  onToggleType,
  onConfidenceChange,
}: CrossEdgeFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="cross-edge-filter">
      <div className="flex flex-wrap gap-1.5">
        {EDGE_TYPES.map(({ type, label, className }) => {
          const active = edgeTypeFilter.has(type);
          return (
            <button
              key={type}
              onClick={() => onToggleType(type)}
              data-testid={`filter-${type}`}
            >
              <Badge
                variant="outline"
                className={cn(
                  'cursor-pointer transition-opacity',
                  active ? className : 'opacity-30',
                )}
              >
                {label}
              </Badge>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <label htmlFor="confidence-slider">Min confidence:</label>
        <input
          id="confidence-slider"
          type="range"
          min={0}
          max={100}
          value={Math.round(minConfidence * 100)}
          onChange={(e) => onConfidenceChange(Number(e.target.value) / 100)}
          className="w-24"
          data-testid="confidence-slider"
        />
        <span className="font-mono w-8">{Math.round(minConfidence * 100)}%</span>
      </div>
    </div>
  );
}
