/**
 * Registry metadata display for a dependency.
 * Shows version comparison, license, homepage, deprecation warning.
 */

import type { Dependency, OutdatedSeverity } from '@deckgraph/shared';
import type { EnrichError } from '@/stores/detailStore';
import { OutdatedBadge } from './OutdatedBadge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ExternalLink, FolderGit2, RefreshCw } from 'lucide-react';

interface RegistryInfoProps {
  readonly dependency: Dependency;
  readonly outdatedSeverity: OutdatedSeverity | null;
  readonly isEnriching: boolean;
  readonly enrichError: EnrichError | null;
  readonly onEnrich: () => void;
}

export function RegistryInfo({ dependency, outdatedSeverity, isEnriching, enrichError, onEnrich }: RegistryInfoProps) {
  const { registryMeta } = dependency;

  // Local/workspace package: nothing to fetch from a public registry.
  if (dependency.local) {
    return (
      <Card className="space-y-1 p-4" data-testid="registry-local">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FolderGit2 className="h-4 w-4 text-muted-foreground" />
          Local package
        </div>
        <p className="text-sm text-muted-foreground">
          {dependency.name} is part of this workspace and isn&apos;t published to a public
          registry, so there&apos;s no registry data to fetch. Open the workspace module directly
          to inspect it.
        </p>
      </Card>
    );
  }

  if (isEnriching) {
    return (
      <Card className="space-y-3 p-4" data-testid="enriching-skeleton">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-64" />
      </Card>
    );
  }

  // An enrichment attempt failed (not-found / registry unreachable). Surface it
  // here in the panel with a retry, rather than reverting to the empty state.
  if (enrichError && !registryMeta) {
    return (
      <Card className="space-y-2 p-4" data-testid="registry-error">
        <div className="flex items-center gap-2 text-sm font-medium text-destructive">
          <AlertTriangle className="h-4 w-4" />
          {enrichError.message}
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{enrichError.suggestion}</p>
          <Button variant="outline" size="sm" onClick={onEnrich} data-testid="enrich-retry-button">
            <RefreshCw className="mr-1 h-3 w-3" />
            Fetch again
          </Button>
        </div>
      </Card>
    );
  }

  if (!registryMeta) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Registry data not yet loaded.</p>
          <Button variant="outline" size="sm" onClick={onEnrich} data-testid="enrich-button">
            <RefreshCw className="mr-1 h-3 w-3" />
            Fetch registry info
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-3 p-4" data-testid="registry-info">
      {registryMeta.deprecated && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          This package is deprecated
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground">Installed</span>
          <p className="font-mono">{dependency.version}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Latest</span>
          <div className="flex items-center gap-2">
            <p className="font-mono">{registryMeta.latestVersion}</p>
            {outdatedSeverity && <OutdatedBadge severity={outdatedSeverity} />}
          </div>
        </div>
        {registryMeta.license && (
          <div>
            <span className="text-muted-foreground">License</span>
            <p>{registryMeta.license}</p>
          </div>
        )}
        {registryMeta.downloads !== null && (
          <div>
            <span className="text-muted-foreground">Downloads</span>
            <p>{registryMeta.downloads.toLocaleString()}</p>
          </div>
        )}
      </div>

      {registryMeta.description && (
        <p className="text-sm text-muted-foreground">{registryMeta.description}</p>
      )}

      {registryMeta.homepage && (
        <a
          href={registryMeta.homepage}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          data-testid="homepage-link"
        >
          <ExternalLink className="h-3 w-3" />
          Homepage
        </a>
      )}

      {registryMeta.publishedAt && (
        <p className="text-xs text-muted-foreground">
          Published: {new Date(registryMeta.publishedAt).toLocaleDateString()}
        </p>
      )}

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onEnrich}>
          <RefreshCw className="mr-1 h-3 w-3" />
          Refresh
        </Button>
      </div>
    </Card>
  );
}
