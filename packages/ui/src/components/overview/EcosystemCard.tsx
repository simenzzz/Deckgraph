/**
 * Card displaying stats for a single ecosystem.
 */

import type { Ecosystem, Module } from '@deckgraph/shared';
import type { KeyboardEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ECOSYSTEM_CONFIG } from '@/lib/ecosystemConfig';

export interface EcosystemCardProps {
  readonly ecosystem: Ecosystem;
  readonly modules: readonly Module[];
  readonly onClick?: () => void;
}

export function EcosystemCard({ ecosystem, modules, onClick }: EcosystemCardProps) {
  const config = ECOSYSTEM_CONFIG[ecosystem];
  const depCount = modules.reduce((sum, m) => sum + m.dependencies.length, 0);

  // H7: Keyboard handler for Enter/Space activation
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <Card
      className={cn(
        'cursor-pointer transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        onClick && 'hover:border-primary/30',
      )}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${config.label}: ${modules.length} module${modules.length !== 1 ? 's' : ''}, ${depCount} dependenc${depCount !== 1 ? 'ies' : 'y'}`}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{config.label}</CardTitle>
        <config.icon className={cn('h-4 w-4', config.colorClass)} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{modules.length}</div>
        <p className="text-xs text-muted-foreground">
          module{modules.length !== 1 ? 's' : ''} &middot; {depCount} dep{depCount !== 1 ? 's' : ''}
        </p>
      </CardContent>
    </Card>
  );
}
