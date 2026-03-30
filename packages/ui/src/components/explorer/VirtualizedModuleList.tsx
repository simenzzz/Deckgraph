/**
 * Virtualized module list using @tanstack/react-virtual.
 *
 * Renders only the visible rows for large module lists (>100 items).
 * 56px row height to accommodate module name + path lines.
 */

import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ModuleView } from '@deckgraph/shared';
import { EcosystemBadge } from './EcosystemBadge';
import { cn } from '@/lib/utils';

const ROW_HEIGHT = 56;

interface VirtualizedModuleListProps {
  readonly modules: readonly ModuleView[];
  readonly selectedModulePath: string | null;
  readonly onSelectModule: (path: string) => void;
}

export function VirtualizedModuleList({
  modules,
  selectedModulePath,
  onSelectModule,
}: VirtualizedModuleListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: modules.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="max-h-[calc(100vh-300px)] overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const mod = modules[virtualRow.index];
          const isSelected = selectedModulePath === mod.path;

          return (
            <button
              key={mod.path}
              onClick={() => onSelectModule(mod.path)}
              className={cn(
                'absolute top-0 left-0 flex w-full items-center px-3 text-sm transition-colors hover:bg-muted/50',
                isSelected && 'bg-accent',
              )}
              data-index={virtualRow.index}
              data-testid={`module-${mod.path}`}
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
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
        })}
      </div>
    </div>
  );
}
