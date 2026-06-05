/**
 * Module Explorer view: FilterBar + ModuleList + DependencyList split pane.
 *
 * When a dependency is selected via detailStore, the right pane shows
 * DependencyDetail instead of DependencyList.
 */

import { FilterBar } from './FilterBar';
import { ModuleList } from './ModuleList';
import { DependencyList } from './DependencyList';
import { DependencyDetail } from '@/components/detail';
import { Separator } from '@/components/ui/separator';
import { useDetailStore } from '@/stores';
import type { WsClient } from '@/lib/wsClient';

interface ModuleExplorerProps {
  readonly wsClient: WsClient | null;
}

export function ModuleExplorer({ wsClient }: ModuleExplorerProps) {
  const selectedDep = useDetailStore((s) => s.selectedDep);

  return (
    <div className="flex h-full flex-col gap-4">
      <h2 className="text-xl font-semibold">Module Explorer</h2>
      <FilterBar />
      <div className="flex flex-1 gap-4 overflow-hidden">
        <div className="w-1/2 overflow-auto rounded-lg border">
          <ModuleList wsClient={wsClient} />
        </div>
        <Separator orientation="vertical" />
        <div className="w-1/2 overflow-auto rounded-lg border p-3">
          {selectedDep ? (
            <DependencyDetail wsClient={wsClient} />
          ) : (
            <DependencyList wsClient={wsClient} />
          )}
        </div>
      </div>
    </div>
  );
}
