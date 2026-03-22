/**
 * List of files that import a specific dependency.
 */

import type { AnalysisState } from '@deckgraph/shared';
import { Card } from '@/components/ui/card';
import { FileText } from 'lucide-react';

interface UsageListProps {
  readonly usedInFiles: readonly string[] | null;
  readonly analysisState: AnalysisState;
}

export function UsageList({ usedInFiles, analysisState }: UsageListProps) {
  if (analysisState === 'manifest-only') {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground" data-testid="usage-not-analyzed">
          Import analysis has not been run for this module yet.
          Trigger &quot;Analyze imports&quot; to see which files use this dependency.
        </p>
      </Card>
    );
  }

  if (!usedInFiles || usedInFiles.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm text-yellow-700" data-testid="usage-unused">
          No imports found. This dependency may be unused.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4" data-testid="usage-list">
      <h4 className="mb-2 text-sm font-medium">
        Used in {usedInFiles.length} file{usedInFiles.length !== 1 ? 's' : ''}
      </h4>
      <ul className="space-y-1">
        {usedInFiles.map((file) => (
          <li key={file} className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
            <FileText className="h-3 w-3 shrink-0" />
            {file}
          </li>
        ))}
      </ul>
    </Card>
  );
}
