/**
 * Update button for the dependency detail panel.
 *
 * Shows when the dependency is outdated and has registry metadata.
 * Opens the UpdateConfirmation dialog on click.
 */

import { useState } from 'react';
import type { Dependency, OutdatedSeverity } from '@deckgraph/shared';
import type { PackageUpdateAction } from '@/hooks/usePackageAction';
import { Button } from '@/components/ui/button';
import { UpdateConfirmation } from './UpdateConfirmation';

interface UpdateButtonProps {
  readonly dependency: Dependency;
  readonly outdatedSeverity: OutdatedSeverity | null;
  readonly modulePath: string;
  readonly updateAction: PackageUpdateAction;
}

export function UpdateButton({
  dependency,
  outdatedSeverity,
  modulePath,
  updateAction,
}: UpdateButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  // Only show the update button if we have registry data and the dep is outdated
  if (!dependency.registryMeta || !outdatedSeverity || outdatedSeverity === 'up-to-date') {
    return null;
  }

  const latestVersion = dependency.registryMeta.latestVersion;

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={updateAction.isUpdating}
        onClick={() => setDialogOpen(true)}
        data-testid="update-button"
      >
        {updateAction.isUpdating ? 'Updating...' : `Update to ${latestVersion}`}
      </Button>

      <UpdateConfirmation
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        dependency={dependency}
        modulePath={modulePath}
        targetVersion={latestVersion}
        isUpdating={updateAction.isUpdating}
        lastResult={updateAction.lastResult}
        onConfirm={() => {
          updateAction.updateTo(latestVersion);
        }}
        onClearResult={updateAction.clearResult}
      />
    </>
  );
}
