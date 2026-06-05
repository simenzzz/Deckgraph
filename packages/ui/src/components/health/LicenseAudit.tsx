/**
 * License audit report.
 * Shows license distribution with copyleft warnings.
 */

import type { LicenseEntry } from '@/hooks/useHealthReport';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle } from 'lucide-react';
import { HealthPrereqEmptyState } from './HealthPrereqEmptyState';
import type { HealthPrereqStore } from '@/stores/healthPrereqStore';

interface LicenseAuditProps {
  readonly licenses: readonly LicenseEntry[];
  readonly hasRegistryData: boolean;
  readonly registryTargetCount?: number;
  readonly registryStatus?: HealthPrereqStore | null;
  readonly actionDisabled?: boolean;
  readonly onOpenRegistryTarget?: () => void;
  readonly onFetchRegistry?: () => void;
}

export function LicenseAudit({
  licenses,
  hasRegistryData,
  registryTargetCount = 0,
  registryStatus = null,
  actionDisabled = false,
  onOpenRegistryTarget = () => {},
  onFetchRegistry = () => {},
}: LicenseAuditProps) {
  if (!hasRegistryData) {
    return (
      <HealthPrereqEmptyState
        testId="license-no-data"
        title="License data has not been fetched"
        description="Open a dependency in Module Explorer or fetch registry info for the visible dependencies."
        explorerLabel="Open in Module Explorer"
        actionLabel="Fetch registry"
        targetCount={registryTargetCount}
        status={registryStatus}
        actionDisabled={actionDisabled}
        onOpenExplorer={onOpenRegistryTarget}
        onRunAction={onFetchRegistry}
      />
    );
  }

  if (licenses.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground" data-testid="license-none">
        No license data available for the current selection.
      </div>
    );
  }

  const copyleftCount = licenses.filter((l) => l.isCopyleft).reduce((sum, l) => sum + l.count, 0);

  return (
    <div data-testid="license-audit">
      {copyleftCount > 0 && (
        <Card className="mb-4 flex items-center gap-2 border-orange-200 bg-orange-50 p-3" data-testid="copyleft-warning">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <p className="text-sm text-orange-800">
            {copyleftCount} dependenc{copyleftCount !== 1 ? 'ies' : 'y'} with copyleft license{copyleftCount !== 1 ? 's' : ''} detected.
            Review for compliance requirements.
          </p>
        </Card>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>License</TableHead>
            <TableHead>Count</TableHead>
            <TableHead>Type</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {licenses.map((entry) => (
            <TableRow key={entry.license}>
              <TableCell className="font-medium">{entry.license}</TableCell>
              <TableCell>{entry.count}</TableCell>
              <TableCell>
                {entry.isCopyleft ? (
                  <Badge variant="destructive">Copyleft</Badge>
                ) : (
                  <Badge variant="secondary">Permissive</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
