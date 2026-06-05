/**
 * Routes ServerMessage to the appropriate Zustand stores.
 */

import type { ServerMessage } from '@deckgraph/shared';
import { useActionStore } from '@/stores/actionStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useDetailStore } from '@/stores/detailStore';
import { useProjectStore } from '@/stores/projectStore';
import { useViewStore } from '@/stores/viewStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useHealthPrereqStore } from '@/stores/healthPrereqStore';
import { resetScanSession } from './sessionReset';

/**
 * Dispatch a validated server message to the correct store.
 */
export function dispatchServerMessage(message: ServerMessage): void {
  switch (message.type) {
    case 'project_overview':
      useProjectStore.getState().setProject(message.data);
      break;

    case 'demo_repository_imported':
      useConnectionStore.getState().addDemoRepository(message.repository);
      useProjectStore.getState().setProject(message.data);
      break;

    case 'workspace_overview': {
      useWorkspaceStore.getState().setWorkspace(message.data);
      break;
    }

    case 'view_result':
      useViewStore.getState().setResult(message.data);
      break;

    case 'progress':
      if (useHealthPrereqStore.getState().active?.requestId === message.requestId) {
        useHealthPrereqStore.getState().setProgress(message.requestId, message.message);
        break;
      }
      useProjectStore.getState().setProgress(message);
      break;

    case 'error': {
      // Enrichment errors are surfaced inside the dependency detail panel
      // (with a retry), not as a global toast that vanishes and leaves the
      // panel looking un-fetched.
      const detail = useDetailStore.getState();
      if (detail.enrichmentRequestId === message.requestId) {
        detail.setEnrichError({ message: message.message, suggestion: message.suggestion });
        break;
      }

      if (useHealthPrereqStore.getState().active?.requestId === message.requestId) {
        useHealthPrereqStore.getState().failRequest(message.requestId, message.message);
        break;
      }

      useConnectionStore.getState().setError(message.message, message.suggestion);
      // H4: Clear loading state so UI doesn't show infinite spinner
      useViewStore.getState().setLoading(false);
      if (useProjectStore.getState().lastProgress?.requestId === message.requestId) {
        useProjectStore.getState().clearScanProgress();
      }
      useDetailStore.getState().completeEnriching(message.requestId);
      useViewStore.getState().completeModuleAnalysis(message.requestId);
      break;
    }

    case 'ready':
      useConnectionStore.getState().setReady(
        message.configPresent,
        message.hasScannedData,
        message.demoMode,
        message.demoRepositories,
      );
      if (!message.hasScannedData) {
        resetScanSession();
      }
      break;

    case 'module_updated':
      useProjectStore.getState().updateModule(message.module);
      useViewStore.getState().completeModuleAnalysis(message.requestId);
      useHealthPrereqStore.getState().completeRequest(message.requestId);
      break;

    case 'dependency_enriched':
      useProjectStore.getState().updateDependency(message.dependency);
      useDetailStore.getState().completeEnriching(message.requestId);
      useHealthPrereqStore.getState().completeRequest(message.requestId);
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

    case 'notification':
      useNotificationStore.getState().addNotification(message);
      break;

    default: {
      const _exhaustive: never = message;
      return _exhaustive;
    }
  }
}
