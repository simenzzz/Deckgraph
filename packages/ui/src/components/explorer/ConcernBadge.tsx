/**
 * Color-coded concern tag badge.
 */

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface ConcernBadgeProps {
  readonly concern: string;
  readonly className?: string;
}

export function ConcernBadge({ concern, className }: ConcernBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px]',
        className,
      )}
    >
      {concern}
    </Badge>
  );
}
