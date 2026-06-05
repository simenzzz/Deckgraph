/**
 * Dependency detail panel.
 *
 * Slide-in replacement for DependencyList when a dep is selected.
 * Shows registry info, usage, transitive deps, and outdated status.
 */

import { useDetailStore } from '@/stores/detailStore';
import { useDependencyDetail } from '@/hooks/useDependencyDetail';
import { usePackageUpdate } from '@/hooks/usePackageAction';
import { RegistryInfo } from './RegistryInfo';
import { UpdateButton } from './UpdateButton';
import { UsageList } from './UsageList';
import { TransitiveDeps } from './TransitiveDeps';
import { OutdatedBadge } from './OutdatedBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft } from 'lucide-react';
import type { WsClient } from '@/lib/wsClient';

interface DependencyDetailProps {
  readonly wsClient: WsClient | null;
}

export function DependencyDetail({ wsClient }: DependencyDetailProps) {
  const closeDep = useDetailStore((s) => s.closeDep);
  const { dependency, modulePath, analysisState, outdatedSeverity, isEnriching, enrichError, requestEnrichment } =
    useDependencyDetail(wsClient);
  const updateAction = usePackageUpdate(dependency, modulePath, wsClient);

  if (!dependency) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
        Dependency not found.
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="dependency-detail">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={closeDep} data-testid="detail-back">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">{dependency.name}</h3>
          <Badge variant="secondary">{dependency.ecosystem}</Badge>
          {outdatedSeverity && <OutdatedBadge severity={outdatedSeverity} />}
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <section>
          <h4 className="mb-2 text-sm font-medium text-muted-foreground">Registry</h4>
          <RegistryInfo
            dependency={dependency}
            outdatedSeverity={outdatedSeverity}
            isEnriching={isEnriching}
            enrichError={enrichError}
            onEnrich={requestEnrichment}
          />
          {modulePath && (
            <div className="mt-2">
              <UpdateButton
                dependency={dependency}
                outdatedSeverity={outdatedSeverity}
                modulePath={modulePath}
                updateAction={updateAction}
              />
            </div>
          )}
        </section>

        <section>
          <h4 className="mb-2 text-sm font-medium text-muted-foreground">Usage</h4>
          <UsageList
            usedInFiles={dependency.usedInFiles}
            analysisState={analysisState ?? 'manifest-only'}
          />
        </section>

        <section>
          <h4 className="mb-2 text-sm font-medium text-muted-foreground">Transitive Dependencies</h4>
          <TransitiveDeps transitiveDeps={dependency.transitiveDeps} local={dependency.local} />
        </section>
      </div>
    </div>
  );
}
