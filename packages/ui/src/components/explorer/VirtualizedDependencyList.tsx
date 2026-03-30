/**
 * Virtualized dependency table using @tanstack/react-virtual.
 *
 * Renders only the visible rows for large dependency lists (>200 items).
 * 48px row height to match standard table row height.
 */

import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Dependency } from '@deckgraph/shared';
import { TableHead } from '@/components/ui/table';
import { ScopeBadge } from './ScopeBadge';
import { ConcernBadge } from './ConcernBadge';
import { DependencyActions } from './DependencyActions';
import type { WsClient } from '@/lib/wsClient';
import { useDetailStore } from '@/stores';

const ROW_HEIGHT = 48;

interface VirtualizedDependencyListProps {
  readonly deps: readonly Dependency[];
  readonly modulePath: string;
  readonly wsClient: WsClient | null;
  readonly sortField: string;
  readonly sortDir: 'asc' | 'desc';
  readonly onToggleSort: (field: string) => void;
}

export function VirtualizedDependencyList({
  deps,
  modulePath,
  wsClient,
  sortField,
  sortDir,
  onToggleSort,
}: VirtualizedDependencyListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: deps.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  return (
    <div>
      {/* Column headers */}
      <div className="flex items-center border-b px-3 py-2 text-xs font-medium text-muted-foreground">
        <SortHead field="name" current={sortField} dir={sortDir} onClick={onToggleSort} className="flex-1">
          Name
        </SortHead>
        <SortHead field="version" current={sortField} dir={sortDir} onClick={onToggleSort} className="w-24">
          Version
        </SortHead>
        <span className="w-24">Constraint</span>
        <SortHead field="scope" current={sortField} dir={sortDir} onClick={onToggleSort} className="w-20">
          Scope
        </SortHead>
        <span className="w-32">Concerns</span>
        <span className="w-24">Actions</span>
      </div>

      <div ref={parentRef} className="max-h-[calc(100vh-380px)] overflow-auto">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const dep = deps[virtualRow.index];

            return (
              <div
                key={`${dep.name}-${dep.ecosystem}`}
                className="absolute top-0 left-0 flex w-full items-center border-b px-3 text-sm"
                data-index={virtualRow.index}
                data-testid={`dep-${dep.name}`}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="flex-1">
                  <DepNameButton dep={dep} />
                </div>
                <div className="w-24 font-mono text-xs">{dep.version}</div>
                <div className="w-24 font-mono text-xs text-muted-foreground">{dep.constraint}</div>
                <div className="w-20">
                  <ScopeBadge scope={dep.scope} />
                </div>
                <div className="flex w-32 flex-wrap gap-1">
                  {dep.concerns.map((c) => (
                    <ConcernBadge key={c} concern={c} />
                  ))}
                </div>
                <div className="w-24">
                  <DependencyActions dep={dep} modulePath={modulePath} wsClient={wsClient} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DepNameButton({ dep }: { readonly dep: Dependency }) {
  const selectDep = useDetailStore((s) => s.selectDep);
  return (
    <button
      className="font-medium text-primary hover:underline"
      onClick={() => selectDep({ name: dep.name, ecosystem: dep.ecosystem })}
      data-testid={`dep-link-${dep.name}`}
    >
      {dep.name}
    </button>
  );
}

function SortHead({
  field,
  current,
  dir,
  onClick,
  className,
  children,
}: {
  readonly field: string;
  readonly current: string;
  readonly dir: 'asc' | 'desc';
  readonly onClick: (field: string) => void;
  readonly className?: string;
  readonly children: React.ReactNode;
}) {
  const isActive = field === current;
  return (
    <button
      onClick={() => onClick(field)}
      className={`flex items-center gap-1 ${className ?? ''}`}
    >
      {children}
      {isActive && <span>{dir === 'asc' ? '\u2191' : '\u2193'}</span>}
    </button>
  );
}
