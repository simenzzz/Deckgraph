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

export interface HeaderProps {
  readonly wsClient: WsClient | null;
}

export function Header({ wsClient }: HeaderProps) {
  const project = useProjectStore((s) => s.project);
  const isScanning = useProjectStore((s) => s.isScanning);
  const status = useConnectionStore((s) => s.status);

  const handleScan = () => {
    wsClient?.send({ type: 'scan_project', requestId: createRequestId() });
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
        <WorkspaceSwitcher />
      </div>
      <div className="flex items-center gap-4">
        <ConnectionIndicator />
        <NotificationPanel />
        <Button
          size="sm"
          onClick={handleScan}
          disabled={status !== 'connected' || isScanning}
        >
          {isScanning ? 'Scanning...' : 'Scan'}
        </Button>
      </div>
    </header>
  );
}
