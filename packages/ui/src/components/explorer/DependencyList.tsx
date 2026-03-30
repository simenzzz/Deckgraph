/**
 * Dependency table for the selected module.
 */

import { useState, useMemo } from 'react';
import type { Dependency, ModuleView } from '@deckgraph/shared';
import { useViewStore, useDetailStore } from '@/stores';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ScopeBadge } from './ScopeBadge';
import { ConcernBadge } from './ConcernBadge';
import { DependencyActions } from './DependencyActions';
import { InstallDialog } from './InstallDialog';
import { VirtualizedDependencyList } from './VirtualizedDependencyList';
import type { WsClient } from '@/lib/wsClient';

type SortField = 'name' | 'version' | 'scope';
type SortDir = 'asc' | 'desc';

interface DependencyListProps {
  readonly wsClient: WsClient | null;
}

export function DependencyList({ wsClient }: DependencyListProps) {
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

  const [installDialogOpen, setInstallDialogOpen] = useState(false);

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

  // Delegate to virtualized list for large datasets
  if (sorted.length > 200) {
    return (
      <div>
        <div className="mb-2 flex items-center justify-between px-1">
          <h3 className="text-sm font-medium">
            {selectedModule.name}
            <span className="ml-2 text-muted-foreground">
              {deps.length} dep{deps.length !== 1 ? 's' : ''}
            </span>
          </h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setInstallDialogOpen(true)}
            data-testid="install-package-button"
          >
            Install Package
          </Button>
        </div>
        <VirtualizedDependencyList
          deps={sorted}
          modulePath={selectedModule.path}
          wsClient={wsClient}
          sortField={sortField}
          sortDir={sortDir}
          onToggleSort={toggleSort}
        />
        <InstallDialog
          open={installDialogOpen}
          onOpenChange={setInstallDialogOpen}
          modulePath={selectedModule.path}
          moduleName={selectedModule.name}
          moduleEcosystem={selectedModule.ecosystem}
          wsClient={wsClient}
        />
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
        <Button
          size="sm"
          variant="outline"
          onClick={() => setInstallDialogOpen(true)}
          data-testid="install-package-button"
        >
          Install Package
        </Button>
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
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((dep) => (
            <DepRow
              key={`${dep.name}-${dep.ecosystem}`}
              dep={dep}
              modulePath={selectedModule.path}
              wsClient={wsClient}
            />
          ))}
        </TableBody>
      </Table>

      <InstallDialog
        open={installDialogOpen}
        onOpenChange={setInstallDialogOpen}
        modulePath={selectedModule.path}
        moduleName={selectedModule.name}
        moduleEcosystem={selectedModule.ecosystem}
        wsClient={wsClient}
      />
    </div>
  );
}

function DepRow({
  dep,
  modulePath,
  wsClient,
}: {
  readonly dep: Dependency;
  readonly modulePath: string;
  readonly wsClient: WsClient | null;
}) {
  const selectDep = useDetailStore((s) => s.selectDep);

  return (
    <TableRow data-testid={`dep-${dep.name}`}>
      <TableCell>
        <button
          className="font-medium text-primary hover:underline"
          onClick={() => selectDep({ name: dep.name, ecosystem: dep.ecosystem })}
          data-testid={`dep-link-${dep.name}`}
        >
          {dep.name}
        </button>
      </TableCell>
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
      <TableCell>
        <DependencyActions dep={dep} modulePath={modulePath} wsClient={wsClient} />
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
