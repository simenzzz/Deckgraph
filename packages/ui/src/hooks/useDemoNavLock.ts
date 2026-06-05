/**
 * Derived selector for the hosted demo's navigation gating.
 */

import { useConnectionStore, useProjectStore } from '@/stores';

/**
 * True when the hosted demo is running and no repository has been imported yet.
 * In demo mode `project` is null until a demo/GitHub repo is imported, so this
 * gates the nav down to just Overview (the "choose a repository" screen).
 */
export function useDemoNavLock(): boolean {
  const demoMode = useConnectionStore((s) => s.demoMode);
  const project = useProjectStore((s) => s.project);
  return demoMode && project === null;
}
