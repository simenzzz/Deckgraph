/**
 * Sortable list of modules from the current view result.
 */

import { useState, useMemo } from 'react';
import type { ModuleView } from '@deckgraph/shared';
import { useViewStore } from '@/stores';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EcosystemBadge } from './EcosystemBadge';
import { VirtualizedModuleList } from './VirtualizedModuleList';
import { cn } from '@/lib/utils';

type SortField = 'name' | 'ecosystem' | 'deps';
type SortDir = 'asc' | 'desc';

export function ModuleList() {
  const result = useViewStore((s) => s.result);
  const selectedModulePath = useViewStore((s) => s.selectedModulePath);
  const selectModule = useViewStore((s) => s.selectModule);

  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const modules = result?.modules ?? [];

  const sorted = useMemo(() => {
    const items = [...modules];
    items.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'name':
          return dir * a.name.localeCompare(b.name);
        case 'ecosystem':
          return dir * a.ecosystem.localeCompare(b.ecosystem);
        case 'deps':
          return dir * (a.dependencies.length - b.dependencies.length);
      }
    });
    return items;
  }, [modules, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  if (modules.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
        No modules match the current filters.
      </div>
    );
  }

  // Delegate to virtualized list for large datasets
  if (sorted.length > 100) {
    return (
      <div className="flex flex-col">
        <div className="flex items-center border-b px-3 py-2 text-xs font-medium text-muted-foreground">
          <span className="flex-1">Module</span>
          <span className="w-20">Ecosystem</span>
          <span className="w-20 text-right">Deps</span>
        </div>
        <VirtualizedModuleList
          modules={sorted}
          selectedModulePath={selectedModulePath}
          onSelectModule={selectModule}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Column headers */}
      <div className="flex items-center border-b px-3 py-2 text-xs font-medium text-muted-foreground">
        <SortHeader field="name" current={sortField} dir={sortDir} onClick={toggleSort} className="flex-1">
          Module
        </SortHeader>
        <SortHeader field="ecosystem" current={sortField} dir={sortDir} onClick={toggleSort} className="w-20">
          Ecosystem
        </SortHeader>
        <SortHeader field="deps" current={sortField} dir={sortDir} onClick={toggleSort} className="w-20 text-right">
          Deps
        </SortHeader>
      </div>

      <ScrollArea className="max-h-[calc(100vh-300px)]">
        {sorted.map((mod) => (
          <ModuleRow
            key={mod.path}
            module={mod}
            isSelected={selectedModulePath === mod.path}
            onSelect={() => selectModule(mod.path)}
          />
        ))}
      </ScrollArea>
    </div>
  );
}

function ModuleRow({
  module: mod,
  isSelected,
  onSelect,
}: {
  readonly module: ModuleView;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'flex w-full items-center px-3 py-2 text-sm transition-colors hover:bg-muted/50',
        isSelected && 'bg-accent',
      )}
      data-testid={`module-${mod.path}`}
    >
      <div className="flex flex-1 flex-col items-start">
        <span className="font-medium">{mod.name}</span>
        <span className="text-xs text-muted-foreground">{mod.path}</span>
      </div>
      <div className="w-20">
        <EcosystemBadge ecosystem={mod.ecosystem} />
      </div>
      <div className="w-20 text-right text-xs">
        <span className="font-medium">{mod.dependencies.length}</span>
        <span className="text-muted-foreground">/{mod.totalDependencyCount}</span>
      </div>
    </button>
  );
}

function SortHeader({
  field,
  current,
  dir,
  onClick,
  className,
  children,
}: {
  readonly field: SortField;
  readonly current: SortField;
  readonly dir: SortDir;
  readonly onClick: (field: SortField) => void;
  readonly className?: string;
  readonly children: React.ReactNode;
}) {
  const isActive = field === current;
  return (
    <button
      onClick={() => onClick(field)}
      className={cn('flex items-center gap-1', className)}
    >
      {children}
      {isActive && <span>{dir === 'asc' ? '\u2191' : '\u2193'}</span>}
    </button>
  );
}
