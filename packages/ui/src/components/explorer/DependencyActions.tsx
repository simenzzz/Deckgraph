/**
 * Per-row action buttons for the dependency list.
 *
 * Renders Update and Remove buttons for each dependency.
 * Update only shows when the dep is outdated with registry data.
 * Remove opens a confirmation dialog with usage warnings.
 */

import { useState } from 'react';
import type { Dependency, PackageActionResult } from '@deckgraph/shared';
import { classifyOutdated } from '@deckgraph/shared';
import { usePackageUpdate, usePackageRemove } from '@/hooks/usePackageAction';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ActionResultDisplay } from '@/components/shared/ActionResultDisplay';
import { useConnectionStore } from '@/stores';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { UpdateConfirmation } from '@/components/detail/UpdateConfirmation';
import type { WsClient } from '@/lib/wsClient';
import { isRelevantResult } from '@/lib/actionUtils';

interface DependencyActionsProps {
  readonly dep: Dependency;
  readonly modulePath: string;
  readonly wsClient: WsClient | null;
}

export function DependencyActions({ dep, modulePath, wsClient }: DependencyActionsProps) {
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const demoMode = useConnectionStore((s) => s.demoMode);

  const updateAction = usePackageUpdate(dep, modulePath, wsClient);
  const removeAction = usePackageRemove(dep, modulePath, wsClient);

  const outdatedSeverity = dep.registryMeta
    ? classifyOutdated(dep.version, dep.registryMeta.latestVersion)
    : null;

  const showUpdateButton =
    dep.registryMeta &&
    outdatedSeverity &&
    outdatedSeverity !== 'up-to-date';

  if (demoMode) {
    return (
      <span className="text-xs text-muted-foreground" title="The hosted demo is read-only">
        Read-only
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {showUpdateButton && (
        <>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            disabled={updateAction.isUpdating}
            onClick={() => setUpdateDialogOpen(true)}
            data-testid={`action-update-${dep.name}`}
          >
            Update
          </Button>
          <UpdateConfirmation
            open={updateDialogOpen}
            onOpenChange={setUpdateDialogOpen}
            dependency={dep}
            modulePath={modulePath}
            targetVersion={dep.registryMeta!.latestVersion}
            isUpdating={updateAction.isUpdating}
            lastResult={updateAction.lastResult}
            onConfirm={() => updateAction.updateTo(dep.registryMeta!.latestVersion)}
            onClearResult={updateAction.clearResult}
          />
        </>
      )}

      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
        disabled={removeAction.isRemoving}
        onClick={() => setRemoveDialogOpen(true)}
        data-testid={`action-remove-${dep.name}`}
      >
        Remove
      </Button>

      <RemoveConfirmation
        open={removeDialogOpen}
        onOpenChange={setRemoveDialogOpen}
        dep={dep}
        modulePath={modulePath}
        isRemoving={removeAction.isRemoving}
        lastResult={removeAction.lastResult}
        onConfirm={removeAction.remove}
        onClearResult={removeAction.clearResult}
      />
    </div>
  );
}

interface RemoveConfirmationProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly dep: Dependency;
  readonly modulePath: string;
  readonly isRemoving: boolean;
  readonly lastResult: PackageActionResult | null;
  readonly onConfirm: () => void;
  readonly onClearResult: () => void;
}

function RemoveConfirmation({
  open,
  onOpenChange,
  dep,
  modulePath,
  isRemoving,
  lastResult,
  onConfirm,
  onClearResult,
}: RemoveConfirmationProps) {
  const relevant = isRelevantResult(lastResult, 'remove', dep.name, modulePath);

  const handleClose = () => {
    if (relevant) {
      onClearResult();
    }
    onOpenChange(false);
  };

  const usageCount = dep.usedInFiles?.length ?? null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent data-testid="remove-confirmation">
        <DialogHeader>
          <DialogTitle>Remove {dep.name}</DialogTitle>
          <DialogDescription>
            Remove {dep.name} {dep.version} from {modulePath}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Ecosystem:</span>
            <Badge variant="secondary">{dep.ecosystem}</Badge>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Scope:</span>
            <Badge variant="outline">{dep.scope}</Badge>
          </div>

          {usageCount !== null && usageCount > 0 && (
            <div className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200" data-testid="remove-usage-warning">
              This package is imported in {usageCount} file{usageCount !== 1 ? 's' : ''}.
              Removing it may cause build errors.
            </div>
          )}

          {usageCount === null && (
            <div className="rounded border p-3 text-sm text-muted-foreground" data-testid="remove-no-analysis-warning">
              Import analysis has not been run for this module.
              This package may still be in use.
            </div>
          )}

          {isRemoving && (
            <div className="rounded border p-3 text-sm text-muted-foreground" data-testid="remove-progress">
              Removing {dep.name}... This may take a moment.
            </div>
          )}

          {relevant && <ActionResultDisplay result={lastResult} actionLabel="Remove" testId="remove-result" />}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={isRemoving}>
            {relevant ? 'Close' : 'Cancel'}
          </Button>
          {!relevant && (
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={isRemoving}
              data-testid="confirm-remove"
            >
              {isRemoving ? 'Removing...' : 'Confirm Remove'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
