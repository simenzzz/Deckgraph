/**
 * Transitive dependency list for a dependency.
 */

import { Card } from '@/components/ui/card';
import { Package } from 'lucide-react';

interface TransitiveDepsProps {
  readonly transitiveDeps: readonly string[] | null;
  readonly local?: boolean;
}

export function TransitiveDeps({ transitiveDeps, local }: TransitiveDepsProps) {
  // Local/workspace packages aren't resolved through a registry, so their
  // transitive graph isn't tracked here.
  if (local) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground" data-testid="transitive-local">
          Transitive dependencies aren&apos;t tracked for local workspace packages. Open the
          module directly to see its dependencies.
        </p>
      </Card>
    );
  }

  if (!transitiveDeps) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground" data-testid="transitive-not-available">
          Transitive dependency analysis isn&apos;t available for this dependency.
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
