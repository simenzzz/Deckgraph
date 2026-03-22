/**
 * Unused dependencies report.
 * Shows dependencies declared in manifests but not found in imports.
 */

import type { UnusedDep } from '@/hooks/useHealthReport';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface UnusedReportProps {
  readonly deps: readonly UnusedDep[];
  readonly hasImportAnalysis: boolean;
}

export function UnusedReport({ deps, hasImportAnalysis }: UnusedReportProps) {
  if (!hasImportAnalysis) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground" data-testid="unused-no-analysis">
        Import analysis has not been run yet. Analyze imports on modules to detect unused dependencies.
      </div>
    );
  }

  if (deps.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground" data-testid="unused-none">
        No unused dependencies detected in analyzed modules.
      </div>
    );
  }

  return (
    <div data-testid="unused-report">
      <p className="mb-3 text-sm text-muted-foreground">
        {deps.length} potentially unused dependenc{deps.length !== 1 ? 'ies' : 'y'}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Ecosystem</TableHead>
            <TableHead>Scope</TableHead>
            <TableHead>Module</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deps.map((dep) => (
            <TableRow key={`${dep.name}-${dep.ecosystem}-${dep.modulePath}`}>
              <TableCell className="font-medium">{dep.name}</TableCell>
              <TableCell>
                <Badge variant="secondary">{dep.ecosystem}</Badge>
              </TableCell>
              <TableCell className="text-xs">{dep.scope}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {dep.moduleName} ({dep.modulePath})
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
