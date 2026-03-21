/**
 * Aggregate health summary for the scanned project.
 */

import type { Project } from '@deckgraph/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface HealthSummaryProps {
  readonly project: Project;
}

export function HealthSummary({ project }: HealthSummaryProps) {
  const totalModules = project.modules.length;
  const totalDeps = project.modules.reduce((sum, m) => sum + m.dependencies.length, 0);

  const runtimeDeps = project.modules.reduce(
    (sum, m) => sum + m.dependencies.filter((d) => d.scope === 'runtime').length,
    0,
  );
  const devDeps = project.modules.reduce(
    (sum, m) => sum + m.dependencies.filter((d) => d.scope === 'dev').length,
    0,
  );
  const crossEdgeCount = project.crossEdges.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Health Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Stat label="Modules" value={totalModules} />
          <Stat label="Total Deps" value={totalDeps} />
          <Stat label="Runtime" value={runtimeDeps} />
          <Stat label="Dev" value={devDeps} />
          <Stat label="Cross-Edges" value={crossEdgeCount} />
        </dl>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { readonly label: string; readonly value: number | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold">{value ?? '\u2014'}</dd>
    </div>
  );
}
