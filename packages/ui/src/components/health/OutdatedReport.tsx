/**
 * Outdated dependencies report.
 * Sortable table showing dependencies behind their latest version.
 */

import { useState, useMemo } from 'react';
import type { OutdatedDep } from '@/hooks/useHealthReport';
import type { OutdatedSeverity } from '@deckgraph/shared';
import { OutdatedBadge, SEVERITY_ORDER } from '@/components/detail/OutdatedBadge';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type SortField = 'name' | 'severity' | 'ecosystem';
type SortDir = 'asc' | 'desc';

interface OutdatedReportProps {
  readonly deps: readonly OutdatedDep[];
  readonly hasRegistryData: boolean;
}

export function OutdatedReport({ deps, hasRegistryData }: OutdatedReportProps) {
  const [sortField, setSortField] = useState<SortField>('severity');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const sorted = useMemo(() => {
    const items = [...deps];
    items.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'name':
          return dir * a.name.localeCompare(b.name);
        case 'ecosystem':
          return dir * a.ecosystem.localeCompare(b.ecosystem);
        case 'severity':
          return dir * (SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
      }
    });
    return items;
  }, [deps, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  if (!hasRegistryData) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground" data-testid="outdated-no-data">
        No registry data available yet. Click a dependency to trigger enrichment.
      </div>
    );
  }

  if (deps.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground" data-testid="outdated-all-current">
        All enriched dependencies are up to date.
      </div>
    );
  }

  return (
    <div data-testid="outdated-report">
      <p className="mb-3 text-sm text-muted-foreground">
        {deps.length} outdated dependenc{deps.length !== 1 ? 'ies' : 'y'}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <button className="flex items-center gap-1" onClick={() => toggleSort('name')}>
                Name {sortField === 'name' && (sortDir === 'asc' ? '\u2191' : '\u2193')}
              </button>
            </TableHead>
            <TableHead>
              <button className="flex items-center gap-1" onClick={() => toggleSort('ecosystem')}>
                Ecosystem {sortField === 'ecosystem' && (sortDir === 'asc' ? '\u2191' : '\u2193')}
              </button>
            </TableHead>
            <TableHead>Installed</TableHead>
            <TableHead>Latest</TableHead>
            <TableHead>
              <button className="flex items-center gap-1" onClick={() => toggleSort('severity')}>
                Severity {sortField === 'severity' && (sortDir === 'asc' ? '\u2191' : '\u2193')}
              </button>
            </TableHead>
            <TableHead>Module</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((dep) => (
            <TableRow key={`${dep.name}-${dep.ecosystem}-${dep.modulePath}`}>
              <TableCell className="font-medium">{dep.name}</TableCell>
              <TableCell>
                <Badge variant="secondary">{dep.ecosystem}</Badge>
              </TableCell>
              <TableCell className="font-mono text-xs">{dep.version}</TableCell>
              <TableCell className="font-mono text-xs">{dep.latestVersion}</TableCell>
              <TableCell>
                <OutdatedBadge severity={dep.severity} />
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{dep.modulePath}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
