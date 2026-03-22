/**
 * Hook for health report data.
 *
 * Derives outdated, unused, and license data from projectStore
 * with filterStore ecosystem/scope filters applied.
 */

import { useMemo } from 'react';
import type { Dependency, Ecosystem, OutdatedSeverity } from '@deckgraph/shared';
import { classifyOutdated } from '@deckgraph/shared';
import { SEVERITY_ORDER } from '@/components/detail/OutdatedBadge';
import { useProjectStore } from '@/stores/projectStore';
import { useFilterStore } from '@/stores/filterStore';

export interface OutdatedDep {
  readonly name: string;
  readonly ecosystem: Ecosystem;
  readonly version: string;
  readonly latestVersion: string;
  readonly severity: OutdatedSeverity;
  readonly modulePath: string;
}

export interface UnusedDep {
  readonly name: string;
  readonly ecosystem: Ecosystem;
  readonly scope: string;
  readonly modulePath: string;
  readonly moduleName: string;
}

export interface LicenseEntry {
  readonly license: string;
  readonly count: number;
  readonly isCopyleft: boolean;
}

export interface HealthReportData {
  readonly outdatedDeps: readonly OutdatedDep[];
  readonly unusedDeps: readonly UnusedDep[];
  readonly licenseDistribution: readonly LicenseEntry[];
  readonly hasImportAnalysis: boolean;
  readonly hasRegistryData: boolean;
}

const COPYLEFT_PATTERNS = ['GPL', 'LGPL', 'AGPL', 'MPL'];

function isCopyleft(license: string): boolean {
  const upper = license.toUpperCase();
  return COPYLEFT_PATTERNS.some((p) => upper.includes(p));
}

function matchesFilters(
  dep: Dependency,
  ecosystems: readonly Ecosystem[],
  scopes: readonly string[],
): boolean {
  if (ecosystems.length > 0 && !ecosystems.includes(dep.ecosystem)) return false;
  if (scopes.length > 0 && !scopes.includes(dep.scope)) return false;
  return true;
}

export function useHealthReport(): HealthReportData {
  const project = useProjectStore((s) => s.project);
  const ecosystems = useFilterStore((s) => s.ecosystems);
  const scopes = useFilterStore((s) => s.scopes);

  return useMemo(() => {
    if (!project) {
      return {
        outdatedDeps: [],
        unusedDeps: [],
        licenseDistribution: [],
        hasImportAnalysis: false,
        hasRegistryData: false,
      };
    }

    const outdated: OutdatedDep[] = [];
    const unused: UnusedDep[] = [];
    const licenseCounts = new Map<string, number>();
    let hasImportAnalysis = false;
    let hasRegistryData = false;

    for (const mod of project.modules) {
      const moduleHasImports = mod.analysisState !== 'manifest-only';
      if (moduleHasImports) hasImportAnalysis = true;

      for (const dep of mod.dependencies) {
        if (!matchesFilters(dep, ecosystems, scopes)) continue;

        // Outdated detection
        if (dep.registryMeta) {
          hasRegistryData = true;
          const severity = classifyOutdated(dep.version, dep.registryMeta.latestVersion);
          if (severity !== 'up-to-date') {
            outdated.push({
              name: dep.name,
              ecosystem: dep.ecosystem,
              version: dep.version,
              latestVersion: dep.registryMeta.latestVersion,
              severity,
              modulePath: mod.path,
            });
          }

          // License tracking
          const license = dep.registryMeta.license ?? 'Unknown';
          licenseCounts.set(license, (licenseCounts.get(license) ?? 0) + 1);
        }

        // Unused detection (only when import analysis has been run)
        if (moduleHasImports && dep.source === 'manifest') {
          if (dep.usedInFiles !== null && dep.usedInFiles.length === 0) {
            unused.push({
              name: dep.name,
              ecosystem: dep.ecosystem,
              scope: dep.scope,
              modulePath: mod.path,
              moduleName: mod.name,
            });
          }
        }
      }
    }

    // Sort outdated by severity (most severe first)
    outdated.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

    // Build license distribution
    const licenseDistribution: LicenseEntry[] = Array.from(licenseCounts.entries())
      .map(([license, count]) => ({
        license,
        count,
        isCopyleft: isCopyleft(license),
      }))
      .sort((a, b) => b.count - a.count);

    return {
      outdatedDeps: outdated,
      unusedDeps: unused,
      licenseDistribution,
      hasImportAnalysis,
      hasRegistryData,
    };
  }, [project, ecosystems, scopes]);
}
