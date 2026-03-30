/**
 * Empty state prompt when no project is scanned.
 *
 * Sends a scan_project request through the normal WsClient flow.
 * The message dispatcher handles the response and updates stores.
 */

import { Button } from '@/components/ui/button';
import { ErrorCard } from '@/components/errors';
import { WelcomeScreen } from '@/components/onboarding';
import { useConnectionStore } from '@/stores';
import { useProjectStore } from '@/stores/projectStore';
import type { WsClient } from '@/lib/wsClient';
import { createRequestId } from '@/lib/wsClient';

export interface ScanPromptProps {
  readonly wsClient: WsClient | null;
}

export function ScanPrompt({ wsClient }: ScanPromptProps) {
  const status = useConnectionStore((s) => s.status);
  const isScanning = useProjectStore((s) => s.isScanning);
  const lastError = useConnectionStore((s) => s.lastError);
  const lastErrorSuggestion = useConnectionStore((s) => s.lastErrorSuggestion);
  const configPresent = useConnectionStore((s) => s.configPresent);
  const clearError = useConnectionStore((s) => s.clearError);

  const handleScan = () => {
    if (!wsClient || status !== 'connected' || isScanning) return;

    // Send scan_project through the normal flow.
    // The message dispatcher will route the response to the correct store.
    wsClient.send({ type: 'scan_project', requestId: createRequestId() });
  };

  // Show welcome screen for first-time users (no config file)
  if (configPresent === false) {
    return <WelcomeScreen wsClient={wsClient} />;
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24">
      <h2 className="text-xl font-semibold text-muted-foreground">No project scanned</h2>
      <p className="text-sm text-muted-foreground">
        Scan a project to explore its dependencies across ecosystems.
      </p>
      {lastError && lastErrorSuggestion && (
        <ErrorCard
          message={lastError}
          suggestion={lastErrorSuggestion}
          onDismiss={clearError}
        />
      )}
      <Button onClick={handleScan} disabled={status !== 'connected' || isScanning}>
        {isScanning ? 'Scanning...' : 'Scan Project'}
      </Button>
    </div>
  );
}
