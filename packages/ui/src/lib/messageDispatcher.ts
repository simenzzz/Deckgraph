/**
 * Routes ServerMessage to the appropriate Zustand stores.
 */

import type { ServerMessage } from '@deckgraph/shared';
import { useActionStore } from '@/stores/actionStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useDetailStore } from '@/stores/detailStore';
import { useProjectStore } from '@/stores/projectStore';
import { useViewStore } from '@/stores/viewStore';

/**
 * Dispatch a validated server message to the correct store.
 */
export function dispatchServerMessage(message: ServerMessage): void {
  switch (message.type) {
    case 'project_overview':
      useProjectStore.getState().setProject(message.data);
      break;

    case 'view_result':
      useViewStore.getState().setResult(message.data);
      break;

    case 'progress':
      useProjectStore.getState().setProgress(message);
      break;

    case 'error':
      useConnectionStore.getState().setError(message.message);
      // H4: Clear loading state so UI doesn't show infinite spinner
      useViewStore.getState().setLoading(false);
      break;

    case 'module_updated':
      useProjectStore.getState().updateModule(message.module);
      break;

    case 'dependency_enriched':
      useProjectStore.getState().updateDependency(message.dependency);
      useDetailStore.getState().setEnriching(false);
      break;

    case 'file_change_detected':
      useProjectStore.getState().setFileChangeInProgress(true);
      break;

    case 'package_action_result':
      useActionStore.getState().completeAction(message.result);
      break;

    case 'package_batch_result':
      useActionStore.getState().batchComplete(message.results);
      break;

    default: {
      const _exhaustive: never = message;
      return _exhaustive;
    }
  }
}
