/**
 * Empty state prompt when no project is scanned.
 *
 * Sends a scan_project request through the normal WsClient flow.
 * The message dispatcher handles the response and updates stores.
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorCard } from '@/components/errors';
import { WelcomeScreen } from '@/components/onboarding';
import { useConnectionStore } from '@/stores';
import { useProjectStore } from '@/stores/projectStore';
import type { WsClient } from '@/lib/wsClient';
import { createRequestId } from '@/lib/wsClient';
import { Github, Link, Play } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';

export interface ScanPromptProps {
  readonly wsClient: WsClient | null;
}

type PendingImportTarget =
  | { readonly kind: 'public'; readonly requestId: string }
  | { readonly kind: 'demo'; readonly requestId: string; readonly repoId: string };

interface ScopeFormState {
  readonly scanRoot: string;
  readonly excludePaths: string;
}

const EMPTY_SCOPE: ScopeFormState = { scanRoot: '', excludePaths: '' };

export function ScanPrompt({ wsClient }: ScanPromptProps) {
  const [repoUrl, setRepoUrl] = useState('');
  const [publicScope, setPublicScope] = useState<ScopeFormState>(EMPTY_SCOPE);
  const [repoScopes, setRepoScopes] = useState<Record<string, ScopeFormState>>({});
  const [pendingImport, setPendingImport] = useState<PendingImportTarget | null>(null);
  const status = useConnectionStore((s) => s.status);
  const isScanning = useProjectStore((s) => s.isScanning);
  const lastProgress = useProjectStore((s) => s.lastProgress);
  const lastError = useConnectionStore((s) => s.lastError);
  const lastErrorSuggestion = useConnectionStore((s) => s.lastErrorSuggestion);
  const configPresent = useConnectionStore((s) => s.configPresent);
  const demoMode = useConnectionStore((s) => s.demoMode);
  const demoRepositories = useConnectionStore((s) => s.demoRepositories);
  const clearError = useConnectionStore((s) => s.clearError);
  const importInProgress = pendingImport !== null || isScanning;

  useEffect(() => {
    if (lastError || status !== 'connected') {
      setPendingImport(null);
    }
  }, [lastError, status]);

  const handleScan = () => {
    if (!wsClient || status !== 'connected' || importInProgress) return;

    // Send scan_project through the normal flow.
    // The message dispatcher will route the response to the correct store.
    wsClient.send({ type: 'scan_project', requestId: createRequestId() });
  };

  const handleImportDemo = (repoId: string) => {
    if (!wsClient || status !== 'connected' || importInProgress) return;
    clearError();
    const requestId = createRequestId();
    const sent = wsClient.send({
      type: 'import_demo_repo',
      requestId,
      repoId,
      ...toScopePayload(repoScopes[repoId] ?? EMPTY_SCOPE),
    });
    if (sent) {
      setPendingImport({ kind: 'demo', requestId, repoId });
    }
  };

  const updateRepoScope = (repoId: string, patch: Partial<ScopeFormState>) => {
    setRepoScopes((current) => ({
      ...current,
      [repoId]: { ...(current[repoId] ?? EMPTY_SCOPE), ...patch },
    }));
  };

  const handlePublicRepoSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const url = repoUrl.trim();
    if (!url || !wsClient || status !== 'connected' || importInProgress) return;

    clearError();
    const requestId = createRequestId();
    const sent = wsClient.send({
      type: 'import_public_github_repo',
      requestId,
      url,
      ...toScopePayload(publicScope),
    });
    if (sent) {
      setPendingImport({ kind: 'public', requestId });
    }
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

        <form
          className="flex max-w-2xl flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm"
          onSubmit={handlePublicRepoSubmit}
        >
          <label htmlFor="public-github-repo-url" className="text-sm font-medium">
            Public GitHub repository URL
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Link
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="public-github-repo-url"
                className="pl-9"
                value={repoUrl}
                onChange={(event) => setRepoUrl(event.target.value)}
                placeholder="https://github.com/owner/repo"
                disabled={status !== 'connected' || importInProgress}
              />
            </div>
            <Button
              type="submit"
              className="gap-2"
              disabled={status !== 'connected' || importInProgress || repoUrl.trim().length === 0}
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              {pendingImport?.kind === 'public' ? 'Scanning...' : 'Scan GitHub Repo'}
            </Button>
          </div>
          <ScopeControls
            idPrefix="public-github-repo"
            scope={publicScope}
            onChange={setPublicScope}
            disabled={status !== 'connected' || importInProgress}
          />
          {lastProgress && (
            <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
              {lastProgress.message}
            </p>
          )}
        </form>

        {demoRepositories.length === 0 ? (
          <ErrorCard
            message="No demo repositories configured"
            suggestion="Set DECKGRAPH_DEMO_REPOS to at least one curated GitHub repository"
          />
        ) : (
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
                <ScopeControls
                  idPrefix={`demo-repo-${repo.id}`}
                  scope={repoScopes[repo.id] ?? EMPTY_SCOPE}
                  onChange={(next) => updateRepoScope(repo.id, next)}
                  disabled={status !== 'connected' || importInProgress}
                  labelPrefix={repo.label}
                />
                <Button
                  className="mt-4 self-start gap-2"
                  onClick={() => handleImportDemo(repo.id)}
                  disabled={status !== 'connected' || importInProgress}
                >
                  <Play className="h-4 w-4" aria-hidden="true" />
                  {pendingImport?.kind === 'demo' && pendingImport.repoId === repo.id ? 'Importing...' : 'Import Demo'}
                </Button>
              </article>
            ))}
          </div>
        )}
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
      <Button onClick={handleScan} disabled={status !== 'connected' || importInProgress}>
        {isScanning ? 'Scanning...' : 'Scan Project'}
      </Button>
    </div>
  );
}

function toScopePayload(scope: ScopeFormState): {
  readonly scanRoot?: string;
  readonly excludePaths?: readonly string[];
} {
  const scanRoot = scope.scanRoot.trim();
  const excludePaths = scope.excludePaths
    .split(/[\n,]/)
    .map((path) => path.trim())
    .filter((path) => path.length > 0);

  return {
    ...(scanRoot ? { scanRoot } : {}),
    ...(excludePaths.length > 0 ? { excludePaths } : {}),
  };
}

function ScopeControls({
  idPrefix,
  scope,
  onChange,
  disabled,
  labelPrefix,
}: {
  readonly idPrefix: string;
  readonly scope: ScopeFormState;
  readonly onChange: (scope: ScopeFormState) => void;
  readonly disabled: boolean;
  readonly labelPrefix?: string;
}) {
  const scanRootLabel = labelPrefix ? `${labelPrefix} scan root path` : 'Scan root path';
  const excludeLabel = labelPrefix ? `${labelPrefix} exclude directories` : 'Exclude directories';

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="space-y-1">
        <label htmlFor={`${idPrefix}-scan-root`} className="text-xs font-medium text-muted-foreground">
          Root path
        </label>
        <Input
          id={`${idPrefix}-scan-root`}
          value={scope.scanRoot}
          onChange={(event) => onChange({ ...scope, scanRoot: event.target.value })}
          placeholder="."
          disabled={disabled}
          aria-label={scanRootLabel}
          className="h-8 text-xs"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor={`${idPrefix}-exclude-paths`} className="text-xs font-medium text-muted-foreground">
          Exclude
        </label>
        <Input
          id={`${idPrefix}-exclude-paths`}
          value={scope.excludePaths}
          onChange={(event) => onChange({ ...scope, excludePaths: event.target.value })}
          placeholder="fixtures, dist"
          disabled={disabled}
          aria-label={excludeLabel}
          className="h-8 text-xs"
        />
      </div>
    </div>
  );
}
