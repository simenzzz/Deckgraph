/**
 * Transitive dependency list for a dependency.
 */

import { Card } from '@/components/ui/card';
import { Package } from 'lucide-react';

interface TransitiveDepsProps {
  readonly transitiveDeps: readonly string[] | null;
}

export function TransitiveDeps({ transitiveDeps }: TransitiveDepsProps) {
  if (!transitiveDeps) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground" data-testid="transitive-not-available">
          Transitive dependency data is not yet available.
        </p>
      </Card>
    );
  }

  if (transitiveDeps.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground" data-testid="transitive-none">
          This dependency has no transitive dependencies.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4" data-testid="transitive-list">
      <h4 className="mb-2 text-sm font-medium">
        {transitiveDeps.length} transitive dep{transitiveDeps.length !== 1 ? 's' : ''}
      </h4>
      <ul className="space-y-1">
        {transitiveDeps.map((dep) => (
          <li key={dep} className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
            <Package className="h-3 w-3 shrink-0" />
            {dep}
          </li>
        ))}
      </ul>
    </Card>
  );
}
