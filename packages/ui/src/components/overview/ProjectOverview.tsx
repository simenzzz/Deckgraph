/**
 * Project Overview page.
 * Shows ecosystem cards grid + health summary.
 * Falls back to ScanPrompt when no project is scanned.
 */

import type { Ecosystem, Module } from '@deckgraph/shared';
import { useProjectStore, useViewStore, useFilterStore } from '@/stores';
import { ALL_ECOSYSTEMS } from '@/lib/ecosystemConfig';
import { EcosystemCard } from './EcosystemCard';
import { HealthSummary } from './HealthSummary';
import { ScanPrompt } from './ScanPrompt';
import type { WsClient } from '@/lib/wsClient';

export interface ProjectOverviewProps {
  readonly wsClient: WsClient | null;
}

export function ProjectOverview({ wsClient }: ProjectOverviewProps) {
  const project = useProjectStore((s) => s.project);
  const setView = useViewStore((s) => s.setView);
  const resetFilters = useFilterStore((s) => s.resetFilters);
  const toggleEcosystem = useFilterStore((s) => s.toggleEcosystem);

  if (!project) {
    return <ScanPrompt wsClient={wsClient} />;
  }

  const modulesByEcosystem = groupByEcosystem(project.modules);
  const activeEcosystems = ALL_ECOSYSTEMS.filter(
    (e) => (modulesByEcosystem.get(e)?.length ?? 0) > 0,
  );

  // M4: Always set (not toggle) the clicked ecosystem as the sole filter
  const handleEcosystemClick = (ecosystem: Ecosystem) => {
    resetFilters();
    toggleEcosystem(ecosystem);
    setView('explorer');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Project Overview</h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {activeEcosystems.map((eco) => (
          <EcosystemCard
            key={eco}
            ecosystem={eco}
            modules={modulesByEcosystem.get(eco) ?? []}
            onClick={() => handleEcosystemClick(eco)}
          />
        ))}
      </div>

      <HealthSummary project={project} />
    </div>
  );
}

// H1: Immutable grouping — no mutation of intermediate arrays
function groupByEcosystem(modules: readonly Module[]): Map<Ecosystem, Module[]> {
  const map = new Map<Ecosystem, Module[]>();
  for (const mod of modules) {
    const existing = map.get(mod.ecosystem) ?? [];
    map.set(mod.ecosystem, [...existing, mod]);
  }
  return map;
}
