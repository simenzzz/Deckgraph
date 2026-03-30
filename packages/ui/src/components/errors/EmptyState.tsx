/**
 * Generic empty-state component for showing placeholder content.
 */

import type { ReactNode } from 'react';

interface EmptyStateProps {
  readonly icon?: ReactNode;
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps): ReactNode {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
