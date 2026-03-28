/**
 * Dialog for installing a new package into the selected module.
 *
 * Provides form fields for package name, version, and scope.
 * Shows progress and result using the same pattern as UpdateConfirmation.
 */

import { useState, useCallback } from 'react';
import type { DependencyScope, Ecosystem } from '@deckgraph/shared';
import { usePackageInstall } from '@/hooks/usePackageAction';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ActionResultDisplay } from '@/components/shared/ActionResultDisplay';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { WsClient } from '@/lib/wsClient';

const SCOPE_OPTIONS: readonly DependencyScope[] = [
  'runtime',
  'dev',
  'build',
  'optional',
  'peer',
];

interface InstallDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly modulePath: string;
  readonly moduleName: string;
  readonly moduleEcosystem: Ecosystem;
  readonly wsClient: WsClient | null;
}

export function InstallDialog({
  open,
  onOpenChange,
  modulePath,
  moduleName,
  moduleEcosystem,
  wsClient,
}: InstallDialogProps) {
  const [packageName, setPackageName] = useState('');
  const [version, setVersion] = useState('');
  const [scope, setScope] = useState<DependencyScope>('runtime');

  const { isInstalling, lastResult, install, clearResult } =
    usePackageInstall(modulePath, wsClient);

  const isRelevantResult =
    lastResult &&
    lastResult.packageName === packageName &&
    lastResult.action === 'install';

  const resetForm = useCallback(() => {
    setPackageName('');
    setVersion('');
    setScope('runtime');
  }, []);

  const handleClose = () => {
    if (isRelevantResult) {
      clearResult();
    }
    resetForm();
    onOpenChange(false);
  };

  const handleConfirm = () => {
    if (!packageName.trim()) return;
    install(
      packageName.trim(),
      moduleEcosystem,
      version.trim() || null,
      scope,
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent data-testid="install-dialog">
        <DialogHeader>
          <DialogTitle>Install Package</DialogTitle>
          <DialogDescription>
            Install a new package into {moduleName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Ecosystem:</span>
            <Badge variant="secondary">{moduleEcosystem}</Badge>
          </div>

          <div className="space-y-1">
            <label htmlFor="install-pkg-name" className="text-sm font-medium">
              Package Name
            </label>
            <Input
              id="install-pkg-name"
              value={packageName}
              onChange={(e) => setPackageName(e.target.value)}
              placeholder="e.g. lodash"
              disabled={isInstalling}
              data-testid="install-package-name"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="install-version" className="text-sm font-medium">
              Version <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="install-version"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="latest"
              disabled={isInstalling}
              data-testid="install-version"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="install-scope" className="text-sm font-medium">
              Scope
            </label>
            <select
              id="install-scope"
              value={scope}
              onChange={(e) => {
                const val = e.target.value;
                if (SCOPE_OPTIONS.includes(val as DependencyScope)) {
                  setScope(val as DependencyScope);
                }
              }}
              disabled={isInstalling}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              data-testid="install-scope"
            >
              {SCOPE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {isInstalling && (
            <div className="rounded border p-3 text-sm text-muted-foreground" data-testid="install-progress">
              Installing {packageName}... This may take a moment.
            </div>
          )}

          {isRelevantResult && <ActionResultDisplay result={lastResult} actionLabel="Install" testId="install-result" />}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={isInstalling}>
            {isRelevantResult ? 'Close' : 'Cancel'}
          </Button>
          {!isRelevantResult && (
            <Button
              onClick={handleConfirm}
              disabled={isInstalling || !packageName.trim()}
              data-testid="confirm-install"
            >
              {isInstalling ? 'Installing...' : 'Install'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

