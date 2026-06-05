import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/errors/EmptyState';
import type { HealthPrereqStore } from '@/stores/healthPrereqStore';
import { ArrowRight, RefreshCw } from 'lucide-react';

interface HealthPrereqEmptyStateProps {
  readonly testId: string;
  readonly title: string;
  readonly description: string;
  readonly explorerLabel: string;
  readonly actionLabel: string;
  readonly targetCount: number;
  readonly status: HealthPrereqStore | null;
  readonly onOpenExplorer: () => void;
  readonly onRunAction: () => void;
  readonly actionDisabled?: boolean;
}

export function HealthPrereqEmptyState({
  testId,
  title,
  description,
  explorerLabel,
  actionLabel,
  targetCount,
  status,
  onOpenExplorer,
  onRunAction,
  actionDisabled = false,
}: HealthPrereqEmptyStateProps) {
  const isRunning = status?.isRunning ?? false;
  const failedCount = status?.failures.length ?? 0;
  const doneCount = (status?.completed ?? 0) + failedCount;
  const activeLabel = status?.active?.target.label;

  return (
    <div data-testid={testId}>
      <EmptyState
        title={title}
        description={description}
        action={
          <div className="flex flex-col items-center gap-2">
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={onOpenExplorer}
                disabled={targetCount === 0}
                data-testid={`${testId}-open-explorer`}
              >
                <ArrowRight className="h-3 w-3" />
                {explorerLabel}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onRunAction}
                disabled={actionDisabled || targetCount === 0 || isRunning}
                data-testid={`${testId}-run-action`}
              >
                <RefreshCw className="h-3 w-3" />
                {isRunning ? 'Working...' : `${actionLabel} (${targetCount})`}
              </Button>
            </div>

            {status && status.total > 0 && (
              <p className="text-xs text-muted-foreground" data-testid={`${testId}-progress`}>
                {isRunning
                  ? `${doneCount}/${status.total} complete${activeLabel ? ` - ${activeLabel}` : ''}`
                  : `${doneCount}/${status.total} complete`}
                {failedCount > 0 ? ` - ${failedCount} failed` : ''}
              </p>
            )}
          </div>
        }
      />
    </div>
  );
}
