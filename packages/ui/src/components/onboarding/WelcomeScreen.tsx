/**
 * Welcome screen for first-time users when no config file exists.
 */

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useConnectionStore, useProjectStore } from '@/stores';
import type { WsClient } from '@/lib/wsClient';
import { createRequestId } from '@/lib/wsClient';

interface WelcomeScreenProps {
  readonly wsClient: WsClient | null;
}

const MINIMAL_CONFIG = `# .deckgraph.yaml
# Add concern tags to surface specific dependencies
concerns:
  - name: security
    description: Security-related dependencies
    match:
      - "helmet"
      - "cors"
      - "bcrypt"`;

export function WelcomeScreen({ wsClient }: WelcomeScreenProps): ReactNode {
  const status = useConnectionStore((s) => s.status);
  const isScanning = useProjectStore((s) => s.isScanning);

  const handleScan = (): void => {
    if (!wsClient || status !== 'connected' || isScanning) return;
    wsClient.send({ type: 'scan_project', requestId: createRequestId() });
  };

  const handleCopyConfig = (): void => {
    navigator.clipboard.writeText(MINIMAL_CONFIG).catch(() => {
      // Clipboard API may fail in some contexts — ignore silently
    });
  };

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16 px-8 max-w-lg mx-auto">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Welcome to Deckgraph</h2>
        <p className="text-sm text-muted-foreground">
          Explore and audit your codebase dependencies across languages.
        </p>
      </div>

      <ol className="space-y-3 text-sm w-full">
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            1
          </span>
          <div className="space-y-1">
            <p className="font-medium">Create a config file (optional)</p>
            <p className="text-muted-foreground">
              Add <code className="text-xs bg-muted px-1 py-0.5 rounded">.deckgraph.yaml</code> to
              your project root to enable concern tags and workspace mode.
            </p>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            2
          </span>
          <div className="space-y-1">
            <p className="font-medium">Scan your project</p>
            <p className="text-muted-foreground">
              Deckgraph auto-detects modules across npm, PyPI, Go, Cargo, and Maven.
            </p>
          </div>
        </li>
      </ol>

      <div className="w-full">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">.deckgraph.yaml</span>
          <button
            onClick={handleCopyConfig}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Copy
          </button>
        </div>
        <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto whitespace-pre">
          {MINIMAL_CONFIG}
        </pre>
      </div>

      <Button
        onClick={handleScan}
        disabled={status !== 'connected' || isScanning}
        size="lg"
      >
        {isScanning ? 'Scanning...' : 'Scan Project'}
      </Button>
    </div>
  );
}
