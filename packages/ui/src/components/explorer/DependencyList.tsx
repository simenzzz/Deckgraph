/**
 * Dependency table for the selected module.
 */

import { useState, useMemo } from 'react';
import type { Dependency, ModuleView } from '@deckgraph/shared';
import { useViewStore } from '@/stores';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScopeBadge } from './ScopeBadge';
import { ConcernBadge } from './ConcernBadge';

type SortField = 'name' | 'version' | 'scope';
type SortDir = 'asc' | 'desc';

export function DependencyList() {
  const result = useViewStore((s) => s.result);
  const selectedModulePath = useViewStore((s) => s.selectedModulePath);

  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const selectedModule: ModuleView | undefined = result?.modules.find(
    (m) => m.path === selectedModulePath,
  );

  const deps = selectedModule?.dependencies ?? [];

  const sorted = useMemo(() => {
    const items = [...deps];
    items.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'name':
          return dir * a.name.localeCompare(b.name);
        case 'version':
          return dir * a.version.localeCompare(b.version);
        case 'scope':
          return dir * a.scope.localeCompare(b.scope);
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

  if (!selectedModule) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
        Select a module to view its dependencies.
      </div>
    );
  }

  if (deps.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
        No dependencies match the current filters.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-sm font-medium">
          {selectedModule.name}
          <span className="ml-2 text-muted-foreground">
            {deps.length} dep{deps.length !== 1 ? 's' : ''}
          </span>
        </h3>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead field="name" current={sortField} dir={sortDir} onClick={toggleSort}>
              Name
            </SortableHead>
            <SortableHead field="version" current={sortField} dir={sortDir} onClick={toggleSort}>
              Version
            </SortableHead>
            <TableHead>Constraint</TableHead>
            <SortableHead field="scope" current={sortField} dir={sortDir} onClick={toggleSort}>
              Scope
            </SortableHead>
            <TableHead>Concerns</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((dep) => (
            <DepRow key={`${dep.name}-${dep.ecosystem}`} dep={dep} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DepRow({ dep }: { readonly dep: Dependency }) {
  return (
    <TableRow data-testid={`dep-${dep.name}`}>
      <TableCell className="font-medium">{dep.name}</TableCell>
      <TableCell className="font-mono text-xs">{dep.version}</TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">{dep.constraint}</TableCell>
      <TableCell>
        <ScopeBadge scope={dep.scope} />
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {dep.concerns.map((c) => (
            <ConcernBadge key={c} concern={c} />
          ))}
        </div>
      </TableCell>
    </TableRow>
  );
}

function SortableHead({
  field,
  current,
  dir,
  onClick,
  children,
}: {
  readonly field: SortField;
  readonly current: SortField;
  readonly dir: SortDir;
  readonly onClick: (field: SortField) => void;
  readonly children: React.ReactNode;
}) {
  const isActive = field === current;
  return (
    <TableHead>
      <button
        onClick={() => onClick(field)}
        className="flex items-center gap-1"
      >
        {children}
        {isActive && <span>{dir === 'asc' ? '\u2191' : '\u2193'}</span>}
      </button>
    </TableHead>
  );
}
