/**
 * Module Explorer view: FilterBar + ModuleList + DependencyList split pane
 * + collapsible CrossEdgeList section.
 */

import { FilterBar } from './FilterBar';
import { ModuleList } from './ModuleList';
import { DependencyList } from './DependencyList';
import { CrossEdgeList } from './CrossEdgeList';
import { Separator } from '@/components/ui/separator';
import { useFilterStore, useViewStore } from '@/stores';

export function ModuleExplorer() {
  const showCrossEdges = useFilterStore((s) => s.showCrossEdges);
  const result = useViewStore((s) => s.result);

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
          <DependencyList />
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
