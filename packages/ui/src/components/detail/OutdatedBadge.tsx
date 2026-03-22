/**
 * Color-coded badge indicating how outdated a dependency is.
 */

import type { OutdatedSeverity } from '@deckgraph/shared';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Numeric ordering for severity (lower = more severe).
 * Used for sorting outdated deps by severity.
 */
export const SEVERITY_ORDER: Record<OutdatedSeverity, number> = {
  'major-behind': 0,
  'minor-behind': 1,
  'patch-behind': 2,
  'up-to-date': 3,
};

const SEVERITY_CONFIG: Record<OutdatedSeverity, { label: string; className: string }> = {
  'up-to-date': { label: 'Up to date', className: 'bg-green-100 text-green-800 border-green-200' },
  'patch-behind': { label: 'Patch behind', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  'minor-behind': { label: 'Minor behind', className: 'bg-orange-100 text-orange-800 border-orange-200' },
  'major-behind': { label: 'Major behind', className: 'bg-red-100 text-red-800 border-red-200' },
};

interface OutdatedBadgeProps {
  readonly severity: OutdatedSeverity;
}

export function OutdatedBadge({ severity }: OutdatedBadgeProps) {
  const config = SEVERITY_CONFIG[severity];
  return (
    <Badge
      variant="outline"
      className={cn(config.className)}
      data-testid={`outdated-badge-${severity}`}
    >
      {config.label}
    </Badge>
  );
}
