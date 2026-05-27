/**
 * Hook for dependency detail data and enrichment.
 *
 * Resolves the selected dependency from projectStore, computes
 * outdated severity, and auto-triggers enrichment when needed.
 */

import { useCallback, useMemo, useEffect, useRef } from 'react';
import type { AnalysisState, Dependency, OutdatedSeverity } from '@deckgraph/shared';
import { classifyOutdated } from '@deckgraph/shared';
import { useDetailStore } from '@/stores/detailStore';
import { useProjectStore } from '@/stores/projectStore';
import type { WsClient } from '@/lib/wsClient';
import { createRequestId } from '@/lib/wsClient';

export interface DependencyDetailData {
  readonly dependency: Dependency | null;
  readonly modulePath: string | null;
  readonly analysisState: AnalysisState | null;
  readonly outdatedSeverity: OutdatedSeverity | null;
  readonly isEnriching: boolean;
  readonly requestEnrichment: () => void;
}

export function useDependencyDetail(wsClient: WsClient | null): DependencyDetailData {
  const selectedDep = useDetailStore((s) => s.selectedDep);
  const isEnriching = useDetailStore((s) => s.isEnriching);
  const project = useProjectStore((s) => s.project);
  const enrichedRef = useRef<string | null>(null);

  const resolved = useMemo(() => {
    if (!selectedDep || !project) return { dependency: null, modulePath: null, analysisState: null };

    for (const mod of project.modules) {
      for (const dep of mod.dependencies) {
        if (dep.name === selectedDep.name && dep.ecosystem === selectedDep.ecosystem) {
          return { dependency: dep, modulePath: mod.path, analysisState: mod.analysisState };
        }
      }
    }
    return { dependency: null, modulePath: null, analysisState: null };
  }, [selectedDep, project]);

  const depVersion = resolved.dependency?.version;
  const latestVersion = resolved.dependency?.registryMeta?.latestVersion;

  const outdatedSeverity = useMemo(() => {
    if (!depVersion || !latestVersion) return null;
    return classifyOutdated(depVersion, latestVersion);
  }, [depVersion, latestVersion]);

  const requestEnrichment = useCallback(() => {
    if (!selectedDep || !wsClient) return;
    const requestId = createRequestId();
    const sent = wsClient.send({
      type: 'enrich_dependency',
      requestId,
      ecosystem: selectedDep.ecosystem,
      packageName: selectedDep.name,
    });
    if (sent) {
      useDetailStore.getState().startEnriching(requestId);
    }
  }, [selectedDep, wsClient]);

  // Auto-trigger enrichment when a dep is selected and has no registry data.
  // Also resets the ref guard when selection is cleared.
  useEffect(() => {
    if (!selectedDep) {
      enrichedRef.current = null;
      return;
    }

    if (!resolved.dependency || isEnriching) return;
    if (resolved.dependency.registryMeta !== null) return;

    const key = `${selectedDep.ecosystem}:${selectedDep.name}`;
    if (enrichedRef.current === key) return;
    enrichedRef.current = key;

    requestEnrichment();
  }, [selectedDep, resolved.dependency, isEnriching, requestEnrichment]);

  return {
    dependency: resolved.dependency,
    modulePath: resolved.modulePath,
    analysisState: resolved.analysisState,
    outdatedSeverity,
    isEnriching,
    requestEnrichment,
  };
}
