/**
 * Project Overview page.
 * Shows ecosystem cards grid + health summary.
 * Falls back to ScanPrompt when no project is scanned.
 */

import type { Ecosystem, Module, Project, Workspace } from '@deckgraph/shared';
import { useProjectStore, useViewStore, useFilterStore, useWorkspaceStore } from '@/stores';
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
  const workspace = useWorkspaceStore((s) => s.workspace);
  const activeProjectRoot = useWorkspaceStore((s) => s.activeProjectRoot);
  const setView = useViewStore((s) => s.setView);
  const resetFilters = useFilterStore((s) => s.resetFilters);
  const toggleEcosystem = useFilterStore((s) => s.toggleEcosystem);
  const displayProject = project ?? buildWorkspaceProject(workspace, activeProjectRoot);

  if (!displayProject) {
    return <ScanPrompt wsClient={wsClient} />;
  }

  const modulesByEcosystem = groupByEcosystem(displayProject.modules);
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
      <h2 className="text-xl font-semibold">
        {project ? 'Project Overview' : 'Workspace Overview'}
      </h2>

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

      <HealthSummary project={displayProject} />
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

function buildWorkspaceProject(
  workspace: Workspace | null,
  activeProjectRoot: string | null,
): Project | null {
  if (!workspace || activeProjectRoot !== null) return null;

  return {
    root: 'Workspace',
    config: null,
    modules: workspace.projects.flatMap((project) => project.modules),
    crossEdges: workspace.projects.flatMap((project) => project.crossEdges),
    lastScannedAt: workspace.lastScannedAt,
  };
}
