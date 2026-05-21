/**
 * Application header with project name, connection indicator, and scan button.
 */

import { useProjectStore, useConnectionStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { ConnectionIndicator } from './ConnectionIndicator';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { NotificationPanel } from './NotificationPanel';
import type { WsClient } from '@/lib/wsClient';
import { createRequestId } from '@/lib/wsClient';
import { resetScanSession } from '@/lib/sessionReset';

export interface HeaderProps {
  readonly wsClient: WsClient | null;
}

export function Header({ wsClient }: HeaderProps) {
  const project = useProjectStore((s) => s.project);
  const isScanning = useProjectStore((s) => s.isScanning);
  const fileChangeInProgress = useProjectStore((s) => s.fileChangeInProgress);
  const status = useConnectionStore((s) => s.status);
  const demoMode = useConnectionStore((s) => s.demoMode);

  const handleScan = () => {
    wsClient?.send({ type: 'scan_project', requestId: createRequestId() });
  };

  const handleChangeDemoRepository = () => {
    resetScanSession();
  };

  const projectName = project
    ? project.root.split('/').pop() ?? 'Project'
    : 'Deckgraph';

  return (
    <header className="flex h-14 items-center justify-between border-b px-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold">{projectName}</h1>
        {project && (
          <span className="text-xs text-muted-foreground">
            {project.modules.length} module{project.modules.length !== 1 ? 's' : ''}
          </span>
        )}
        {fileChangeInProgress && (
          <span className="text-xs text-amber-600 animate-pulse" role="status" aria-live="polite">Updating...</span>
        )}
        <WorkspaceSwitcher />
      </div>
      <div className="flex items-center gap-4">
        <ConnectionIndicator />
        <NotificationPanel />
        {!demoMode && (
          <Button
            size="sm"
            onClick={handleScan}
            disabled={status !== 'connected' || isScanning}
          >
            {isScanning ? 'Scanning...' : 'Scan'}
          </Button>
        )}
        {demoMode && project && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleChangeDemoRepository}
            disabled={isScanning}
          >
            Change Repository
          </Button>
        )}
      </div>
    </header>
  );
}
