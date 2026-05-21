/**
 * Batch action buttons for the Health Report.
 *
 * Provides "Update All Outdated" and "Remove All Unused" buttons
 * with confirmation dialogs, progress tracking, and result summaries.
 */

import { useState, useMemo } from 'react';
import type { PackageActionResult, PackageBatchOperation } from '@deckgraph/shared';
import { usePackageBatch } from '@/hooks/usePackageAction';
import type { OutdatedDep, UnusedDep } from '@/hooks/useHealthReport';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useConnectionStore } from '@/stores';
import type { WsClient } from '@/lib/wsClient';

interface BatchActionsProps {
  readonly outdatedDeps: readonly OutdatedDep[];
  readonly unusedDeps: readonly UnusedDep[];
  readonly wsClient: WsClient | null;
}

export function BatchActions({ outdatedDeps, unusedDeps, wsClient }: BatchActionsProps) {
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const demoMode = useConnectionStore((s) => s.demoMode);

  const { isBatchRunning, batchResults, runBatch, clearBatch } =
    usePackageBatch(wsClient);

  const handleOpenUpdate = () => {
    clearBatch();
    setUpdateDialogOpen(true);
  };

  const handleOpenRemove = () => {
    clearBatch();
    setRemoveDialogOpen(true);
  };

  const updateOperations = useMemo<readonly PackageBatchOperation[]>(
    () =>
      outdatedDeps.map((dep) => ({
        action: 'update' as const,
        ecosystem: dep.ecosystem,
        packageName: dep.name,
        modulePath: dep.modulePath,
        targetVersion: dep.latestVersion,
        scope: null,
      })),
    [outdatedDeps],
  );

  const removeOperations = useMemo<readonly PackageBatchOperation[]>(
    () =>
      unusedDeps.map((dep) => ({
        action: 'remove' as const,
        ecosystem: dep.ecosystem,
        packageName: dep.name,
        modulePath: dep.modulePath,
        targetVersion: null,
        scope: null,
      })),
    [unusedDeps],
  );

  if (demoMode) {
    return (
      <div className="text-xs text-muted-foreground" data-testid="batch-actions-readonly">
        Hosted demo is read-only.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2" data-testid="batch-actions">
      <Button
        size="sm"
        variant="outline"
        disabled={outdatedDeps.length === 0 || isBatchRunning}
        onClick={handleOpenUpdate}
        data-testid="batch-update-all"
      >
        Update All Outdated{outdatedDeps.length > 0 ? ` (${outdatedDeps.length})` : ''}
      </Button>

      <Button
        size="sm"
        variant="outline"
        disabled={unusedDeps.length === 0 || isBatchRunning}
        onClick={handleOpenRemove}
        data-testid="batch-remove-all"
      >
        Remove All Unused{unusedDeps.length > 0 ? ` (${unusedDeps.length})` : ''}
      </Button>

      <BatchConfirmation
        open={updateDialogOpen}
        onOpenChange={setUpdateDialogOpen}
        title={`Update ${outdatedDeps.length} Outdated Dependencies`}
        description="The following packages will be updated to their latest versions."
        operations={updateOperations}
        isBatchRunning={isBatchRunning}
        batchResults={batchResults}
        onConfirm={() => runBatch(updateOperations)}
        onClear={clearBatch}
        renderOperation={(op) => (
          <span>
            {op.packageName} → {op.targetVersion}
            <span className="ml-1 text-muted-foreground">in {op.modulePath}</span>
          </span>
        )}
      />

      <BatchConfirmation
        open={removeDialogOpen}
        onOpenChange={setRemoveDialogOpen}
        title={`Remove ${unusedDeps.length} Unused Dependencies`}
        description="The following unused packages will be removed."
        operations={removeOperations}
        isBatchRunning={isBatchRunning}
        batchResults={batchResults}
        onConfirm={() => runBatch(removeOperations)}
        onClear={clearBatch}
        renderOperation={(op) => (
          <span>
            {op.packageName}
            <span className="ml-1 text-muted-foreground">in {op.modulePath}</span>
          </span>
        )}
      />
    </div>
  );
}

interface BatchConfirmationProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description: string;
  readonly operations: readonly PackageBatchOperation[];
  readonly isBatchRunning: boolean;
  readonly batchResults: readonly PackageActionResult[];
  readonly onConfirm: () => void;
  readonly onClear: () => void;
  readonly renderOperation: (op: PackageBatchOperation) => React.ReactNode;
}

function BatchConfirmation({
  open,
  onOpenChange,
  title,
  description,
  operations,
  isBatchRunning,
  batchResults,
  onConfirm,
  onClear,
  renderOperation,
}: BatchConfirmationProps) {
  const hasResults = batchResults.length > 0;

  const handleClose = () => {
    if (hasResults) {
      onClear();
    }
    onOpenChange(false);
  };

  const successCount = batchResults.filter((r) => r.status === 'success').length;
  const failureCount = batchResults.filter((r) => r.status !== 'success').length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg" data-testid="batch-confirmation">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {!hasResults && !isBatchRunning && (
            <>
              <ScrollArea className="max-h-60 rounded border p-2">
                <ul className="space-y-1 text-sm">
                  {operations.map((op, i) => (
                    <li key={`${op.packageName}-${op.modulePath}-${i}`} className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {op.ecosystem}
                      </Badge>
                      {renderOperation(op)}
                    </li>
                  ))}
                </ul>
              </ScrollArea>

              <div className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200">
                Operations run sequentially and will stop on first failure.
              </div>
            </>
          )}

          {isBatchRunning && (
            <div className="rounded border p-3 text-sm text-muted-foreground" data-testid="batch-progress">
              Running batch operations... This may take a while.
            </div>
          )}

          {hasResults && (
            <div className="space-y-3" data-testid="batch-results">
              <div className="flex items-center gap-3 text-sm">
                {successCount > 0 && (
                  <span className="font-medium text-green-600">
                    {successCount} succeeded
                  </span>
                )}
                {failureCount > 0 && (
                  <span className="font-medium text-red-600">
                    {failureCount} failed
                  </span>
                )}
              </div>

              <ScrollArea className="max-h-60 rounded border p-2">
                <ul className="space-y-2 text-sm">
                  {batchResults.map((r, i) => (
                    <BatchResultRow key={`${r.packageName}-${r.modulePath}-${i}`} result={r} />
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={isBatchRunning}>
            {hasResults ? 'Close' : 'Cancel'}
          </Button>
          {!hasResults && (
            <Button
              onClick={onConfirm}
              disabled={isBatchRunning || operations.length === 0}
              data-testid="confirm-batch"
            >
              {isBatchRunning ? 'Running...' : `Confirm (${operations.length})`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BatchResultRow({ result }: { readonly result: PackageActionResult }) {
  const isSuccess = result.status === 'success';

  return (
    <li className="flex items-center gap-2">
      <span className={isSuccess ? 'text-green-600' : 'text-red-600'}>
        {isSuccess ? '\u2713' : '\u2717'}
      </span>
      <Badge variant="secondary" className="text-xs">
        {result.ecosystem}
      </Badge>
      <span className="font-medium">{result.packageName}</span>
      <span className="text-muted-foreground">{result.modulePath}</span>
      {result.error && (
        <span className="text-xs text-red-500">- {result.error}</span>
      )}
    </li>
  );
}
