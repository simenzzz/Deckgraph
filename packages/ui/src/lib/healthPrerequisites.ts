import type { DependencyScope, Ecosystem, Project } from '@deckgraph/shared';

export interface RegistryPrereqTarget {
  readonly kind: 'registry';
  readonly targetId: string;
  readonly label: string;
  readonly ecosystem: Ecosystem;
  readonly packageName: string;
  readonly modulePath: string;
}

export interface ImportPrereqTarget {
  readonly kind: 'imports';
  readonly targetId: string;
  readonly label: string;
  readonly modulePath: string;
}

export type HealthPrereqTarget = RegistryPrereqTarget | ImportPrereqTarget;

export interface HealthPrereqFilters {
  readonly ecosystems: readonly Ecosystem[];
  readonly scopes: readonly DependencyScope[];
}

function dependencyMatchesFilters(
  dep: { readonly ecosystem: Ecosystem; readonly scope: DependencyScope },
  filters: HealthPrereqFilters,
): boolean {
  if (filters.ecosystems.length > 0 && !filters.ecosystems.includes(dep.ecosystem)) return false;
  if (filters.scopes.length > 0 && !filters.scopes.includes(dep.scope)) return false;
  return true;
}

export function getRegistryPrereqTargets(
  project: Project | null,
  filters: HealthPrereqFilters,
): RegistryPrereqTarget[] {
  if (!project) return [];

  const seen = new Set<string>();
  const targets: RegistryPrereqTarget[] = [];

  for (const mod of project.modules) {
    for (const dep of mod.dependencies) {
      if (!dependencyMatchesFilters(dep, filters)) continue;
      if (dep.registryMeta !== null || dep.local) continue;

      const targetId = `${dep.ecosystem}:${dep.name}`;
      if (seen.has(targetId)) continue;
      seen.add(targetId);

      targets.push({
        kind: 'registry',
        targetId,
        label: dep.name,
        ecosystem: dep.ecosystem,
        packageName: dep.name,
        modulePath: mod.path,
      });
    }
  }

  return targets;
}

export function getImportPrereqTargets(
  project: Project | null,
  filters: HealthPrereqFilters,
): ImportPrereqTarget[] {
  if (!project) return [];

  return project.modules
    .filter((mod) => {
      if (mod.analysisState !== 'manifest-only') return false;
      return mod.dependencies.some((dep) => dependencyMatchesFilters(dep, filters));
    })
    .map((mod) => ({
      kind: 'imports' as const,
      targetId: mod.path,
      label: mod.name,
      modulePath: mod.path,
    }));
}
