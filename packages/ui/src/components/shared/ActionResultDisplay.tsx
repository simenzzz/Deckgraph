/**
 * Shared result display for package management actions.
 *
 * Shows success/failure status, the CLI command executed, and any error message.
 * Used by UpdateConfirmation, InstallDialog, and DependencyActions (remove).
 */

import type { PackageActionResult } from '@deckgraph/shared';

interface ActionResultDisplayProps {
  readonly result: PackageActionResult;
  readonly actionLabel: string;
  readonly testId?: string;
}

export function ActionResultDisplay({ result, actionLabel, testId }: ActionResultDisplayProps) {
  const isSuccess = result.status === 'success';
  const statusColor = isSuccess ? 'text-green-600' : 'text-red-600';

  return (
    <div className="space-y-2 rounded border p-3" data-testid={testId}>
      <div className={`text-sm font-medium ${statusColor}`}>
        {isSuccess ? `${actionLabel} successful` : `${actionLabel} ${result.status}`}
      </div>
      {result.command && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">Command:</span>{' '}
          <code className="rounded bg-muted px-1 py-0.5">{result.command}</code>
        </div>
      )}
      {result.error && (
        <div className="text-xs text-red-500">{result.error}</div>
      )}
    </div>
  );
}
