/**
 * Update confirmation dialog.
 *
 * Shows package name, version change, ecosystem, and a preview of the
 * CLI command that will be executed. Shows progress and results.
 */

import type { Dependency } from '@deckgraph/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ActionResultDisplay } from '@/components/shared/ActionResultDisplay';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface UpdateConfirmationProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly dependency: Dependency;
  readonly modulePath: string;
  readonly targetVersion: string;
  readonly isUpdating: boolean;
  readonly lastResult: PackageActionResult | null;
  readonly onConfirm: () => void;
  readonly onClearResult: () => void;
}

export function UpdateConfirmation({
  open,
  onOpenChange,
  dependency,
  modulePath,
  targetVersion,
  isUpdating,
  lastResult,
  onConfirm,
  onClearResult,
}: UpdateConfirmationProps) {
  const isRelevantResult =
    lastResult &&
    lastResult.packageName === dependency.name &&
    lastResult.action === 'update';

  const handleClose = () => {
    if (isRelevantResult) {
      onClearResult();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent data-testid="update-confirmation">
        <DialogHeader>
          <DialogTitle>Update {dependency.name}</DialogTitle>
          <DialogDescription>
            Update from {dependency.version} to {targetVersion} in {modulePath}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Ecosystem:</span>
            <Badge variant="secondary">{dependency.ecosystem}</Badge>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Version:</span>
            <span className="line-through text-muted-foreground">{dependency.version}</span>
            <span>→</span>
            <span className="font-medium">{targetVersion}</span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Scope:</span>
            <Badge variant="outline">{dependency.scope}</Badge>
          </div>

          {isUpdating && (
            <div className="rounded border p-3 text-sm text-muted-foreground" data-testid="update-progress">
              Executing update... This may take a moment.
            </div>
          )}

          {isRelevantResult && (
            <ActionResultDisplay result={lastResult} actionLabel="Update" testId="update-result" />
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={isUpdating}>
            {isRelevantResult ? 'Close' : 'Cancel'}
          </Button>
          {!isRelevantResult && (
            <Button onClick={onConfirm} disabled={isUpdating} data-testid="confirm-update">
              {isUpdating ? 'Updating...' : 'Confirm Update'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

