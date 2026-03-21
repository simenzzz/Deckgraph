/**
 * Empty state prompt when no project is scanned.
 */

import { Button } from '@/components/ui/button';
import { useConnectionStore } from '@/stores';
import type { WsClient } from '@/lib/wsClient';
import { createRequestId } from '@/lib/wsClient';

export interface ScanPromptProps {
  readonly wsClient: WsClient | null;
}

export function ScanPrompt({ wsClient }: ScanPromptProps) {
  const status = useConnectionStore((s) => s.status);

  const handleScan = () => {
    wsClient?.send({ type: 'scan_project', requestId: createRequestId() });
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24">
      <h2 className="text-xl font-semibold text-muted-foreground">No project scanned</h2>
      <p className="text-sm text-muted-foreground">
        Scan a project to explore its dependencies across ecosystems.
      </p>
      <Button onClick={handleScan} disabled={status !== 'connected'}>
        Scan Project
      </Button>
    </div>
  );
}
