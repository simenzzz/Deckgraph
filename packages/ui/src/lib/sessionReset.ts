/**
 * Reset loaded scan/session data while preserving connection metadata.
 */

import { useActionStore } from '@/stores/actionStore';
import { useDetailStore } from '@/stores/detailStore';
import { useFilterStore } from '@/stores/filterStore';
import { useProjectStore } from '@/stores/projectStore';
import { useViewStore } from '@/stores/viewStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export function resetScanSession(): void {
  useProjectStore.getState().clear();
  useWorkspaceStore.getState().clear();
  useViewStore.getState().clear();
  useDetailStore.getState().closeDep();
  useActionStore.getState().reset();
  useFilterStore.getState().resetFilters();
}
