/**
 * Module Explorer view: FilterBar + ModuleList + DependencyList split pane
 * + collapsible CrossEdgeList section.
 *
 * When a dependency is selected via detailStore, the right pane shows
 * DependencyDetail instead of DependencyList.
 */

import { FilterBar } from './FilterBar';
import { ModuleList } from './ModuleList';
import { DependencyList } from './DependencyList';
import { CrossEdgeList } from './CrossEdgeList';
import { DependencyDetail } from '@/components/detail';
import { Separator } from '@/components/ui/separator';
import { useFilterStore, useViewStore, useDetailStore } from '@/stores';
import type { WsClient } from '@/lib/wsClient';

interface ModuleExplorerProps {
  readonly wsClient: WsClient | null;
}

export function ModuleExplorer({ wsClient }: ModuleExplorerProps) {
  const showCrossEdges = useFilterStore((s) => s.showCrossEdges);
  const result = useViewStore((s) => s.result);
  const selectedDep = useDetailStore((s) => s.selectedDep);

  const crossEdges = result?.crossEdges ?? [];
  const showSection = showCrossEdges && crossEdges.length > 0;

  return (
    <div className="flex h-full flex-col gap-4">
      <h2 className="text-xl font-semibold">Module Explorer</h2>
      <FilterBar />
      <div className="flex flex-1 gap-4 overflow-hidden">
        <div className="w-1/2 overflow-auto rounded-lg border">
          <ModuleList />
        </div>
        <Separator orientation="vertical" />
        <div className="w-1/2 overflow-auto rounded-lg border p-3">
          {selectedDep ? (
            <DependencyDetail wsClient={wsClient} />
          ) : (
            <DependencyList />
          )}
        </div>
      </div>
      {showSection && (
        <div className="rounded-lg border p-3">
          <h3 className="mb-2 text-sm font-medium">
            Cross-Language Edges
            <span className="ml-2 text-muted-foreground">
              {crossEdges.length} edge{crossEdges.length !== 1 ? 's' : ''}
            </span>
          </h3>
          <CrossEdgeList crossEdges={crossEdges} />
        </div>
      )}
    </div>
  );
}
