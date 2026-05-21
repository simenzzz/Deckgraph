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
import { Github, Play } from 'lucide-react';

export interface ScanPromptProps {
  readonly wsClient: WsClient | null;
}

export function ScanPrompt({ wsClient }: ScanPromptProps) {
  const status = useConnectionStore((s) => s.status);
  const isScanning = useProjectStore((s) => s.isScanning);
  const lastError = useConnectionStore((s) => s.lastError);
  const lastErrorSuggestion = useConnectionStore((s) => s.lastErrorSuggestion);
  const configPresent = useConnectionStore((s) => s.configPresent);
  const demoMode = useConnectionStore((s) => s.demoMode);
  const demoRepositories = useConnectionStore((s) => s.demoRepositories);
  const clearError = useConnectionStore((s) => s.clearError);

  const handleScan = () => {
    if (!wsClient || status !== 'connected' || isScanning) return;

    // Send scan_project through the normal flow.
    // The message dispatcher will route the response to the correct store.
    wsClient.send({ type: 'scan_project', requestId: createRequestId() });
  };

  const handleImportDemo = (repoId: string) => {
    if (!wsClient || status !== 'connected' || isScanning) return;
    clearError();
    wsClient.send({ type: 'import_demo_repo', requestId: createRequestId(), repoId });
  };

  if (demoMode) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6 py-12">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Github className="h-4 w-4" aria-hidden="true" />
            Hosted GitHub demo
          </div>
          <h2 className="text-2xl font-semibold">Choose a repository to scan</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Deckgraph will import a curated public GitHub repository and build a dependency map
            across the ecosystems it finds.
          </p>
        </div>

        {lastError && lastErrorSuggestion && (
          <ErrorCard
            message={lastError}
            suggestion={lastErrorSuggestion}
            onDismiss={clearError}
          />
        )}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {demoRepositories.map((repo) => (
            <article
              key={repo.id}
              className="flex min-h-44 flex-col justify-between rounded-lg border bg-card p-4 shadow-sm"
            >
              <div className="space-y-2">
                <h3 className="text-base font-semibold">{repo.label}</h3>
                <p className="text-sm leading-6 text-muted-foreground">{repo.description}</p>
                <p className="truncate text-xs text-muted-foreground">{repo.url}</p>
              </div>
              <Button
                className="mt-4 self-start gap-2"
                onClick={() => handleImportDemo(repo.id)}
                disabled={status !== 'connected' || isScanning}
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                {isScanning ? 'Importing...' : 'Import Demo'}
              </Button>
            </article>
          ))}
        </div>
      </div>
    );
  }

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
