/**
 * Color-coded ecosystem badge.
 */

import type { Ecosystem } from '@deckgraph/shared';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ECOSYSTEM_CONFIG } from '@/lib/ecosystemConfig';

export interface EcosystemBadgeProps {
  readonly ecosystem: Ecosystem;
  readonly className?: string;
}

export function EcosystemBadge({ ecosystem, className }: EcosystemBadgeProps) {
  const config = ECOSYSTEM_CONFIG[ecosystem];
  return (
    <Badge
      variant="outline"
      className={cn(config.badgeClass, className)}
    >
      {config.label}
    </Badge>
  );
}
