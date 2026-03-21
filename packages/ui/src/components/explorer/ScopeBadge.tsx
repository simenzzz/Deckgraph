/**
 * Color-coded dependency scope badge.
 */

import type { DependencyScope } from '@deckgraph/shared';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const SCOPE_STYLES: Record<DependencyScope, string> = {
  runtime: 'bg-green-100 text-green-800 border-green-300',
  dev: 'bg-blue-100 text-blue-800 border-blue-300',
  build: 'bg-purple-100 text-purple-800 border-purple-300',
  optional: 'bg-gray-100 text-gray-700 border-gray-300',
  peer: 'bg-amber-100 text-amber-800 border-amber-300',
};

export interface ScopeBadgeProps {
  readonly scope: DependencyScope;
  readonly className?: string;
}

export function ScopeBadge({ scope, className }: ScopeBadgeProps) {
  return (
    <Badge variant="outline" className={cn(SCOPE_STYLES[scope], className)}>
      {scope}
    </Badge>
  );
}
