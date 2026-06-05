import { useEffect, useMemo } from 'react';
import { useDetailStore, useFilterStore, useHealthPrereqStore, useProjectStore, useViewStore } from '@/stores';
import {
  getImportPrereqTargets,
  getRegistryPrereqTargets,
  type HealthPrereqTarget,
  type ImportPrereqTarget,
  type RegistryPrereqTarget,
} from '@/lib/healthPrerequisites';
import type { WsClient } from '@/lib/wsClient';
import { createRequestId } from '@/lib/wsClient';

export function useHealthPrerequisiteActions(wsClient: WsClient | null) {
  const project = useProjectStore((s) => s.project);
  const ecosystems = useFilterStore((s) => s.ecosystems);
  const scopes = useFilterStore((s) => s.scopes);
  const setView = useViewStore((s) => s.setView);
  const selectModule = useViewStore((s) => s.selectModule);
  const prereq = useHealthPrereqStore();

  const filters = useMemo(() => ({ ecosystems, scopes }), [ecosystems, scopes]);

  const registryTargets = useMemo(
    () => getRegistryPrereqTargets(project, filters),
    [project, filters],
  );
  const importTargets = useMemo(
    () => getImportPrereqTargets(project, filters),
    [project, filters],
  );

  useEffect(() => {
    if (!prereq.isRunning || prereq.active !== null || prereq.queue.length === 0) return;

    const target = prereq.queue[0]!;
    const requestId = createRequestId();
    const sent = sendPrereqMessage(wsClient, requestId, target);

    if (sent) {
      useHealthPrereqStore.getState().markSent(requestId, target);
    } else {
      useHealthPrereqStore.getState().markSendFailed(target, 'Connection is not available');
    }
  }, [prereq.active, prereq.isRunning, prereq.queue, wsClient]);

  const openRegistryTarget = () => {
    const target = registryTargets[0];
    if (!target) return;
    openRegistryInExplorer(target, setView, selectModule);
  };

  const openImportTarget = () => {
    const target = importTargets[0];
    if (!target) return;
    openImportsInExplorer(target, setView, selectModule);
  };

  const fetchVisibleRegistry = () => {
    useHealthPrereqStore.getState().startBatch('registry', registryTargets);
  };

  const analyzeVisibleImports = () => {
    useHealthPrereqStore.getState().startBatch('imports', importTargets);
  };

  return {
    registryTargets,
    importTargets,
    registryStatus: prereq.kind === 'registry' ? prereq : null,
    importStatus: prereq.kind === 'imports' ? prereq : null,
    openRegistryTarget,
    openImportTarget,
    fetchVisibleRegistry,
    analyzeVisibleImports,
  };
}

function sendPrereqMessage(
  wsClient: WsClient | null,
  requestId: string,
  target: HealthPrereqTarget,
): boolean {
  if (target.kind === 'registry') {
    return wsClient?.send({
      type: 'enrich_dependency',
      requestId,
      ecosystem: target.ecosystem,
      packageName: target.packageName,
    }) ?? false;
  }

  return wsClient?.send({
    type: 'analyze_imports',
    requestId,
    modulePath: target.modulePath,
  }) ?? false;
}

function openRegistryInExplorer(
  target: RegistryPrereqTarget,
  setView: (view: 'explorer') => void,
  selectModule: (path: string | null) => void,
): void {
  selectModule(target.modulePath);
  useDetailStore.getState().selectDep({ name: target.packageName, ecosystem: target.ecosystem });
  setView('explorer');
}

function openImportsInExplorer(
  target: ImportPrereqTarget,
  setView: (view: 'explorer') => void,
  selectModule: (path: string | null) => void,
): void {
  useDetailStore.getState().closeDep();
  selectModule(target.modulePath);
  setView('explorer');
}
