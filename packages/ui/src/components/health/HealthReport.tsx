/**
 * Health Report view.
 * Tabbed interface showing Outdated, Unused, and License Audit reports.
 * Includes batch action buttons for bulk update/remove operations.
 */

import { useHealthReport } from '@/hooks/useHealthReport';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OutdatedReport } from './OutdatedReport';
import { UnusedReport } from './UnusedReport';
import { LicenseAudit } from './LicenseAudit';
import { BatchActions } from './BatchActions';
import type { WsClient } from '@/lib/wsClient';

interface HealthReportProps {
  readonly wsClient: WsClient | null;
}

export function HealthReport({ wsClient }: HealthReportProps) {
  const { outdatedDeps, unusedDeps, licenseDistribution, hasImportAnalysis, hasRegistryData } =
    useHealthReport();

  return (
    <div className="space-y-4" data-testid="health-report">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Health Report</h2>
        <BatchActions
          outdatedDeps={outdatedDeps}
          unusedDeps={unusedDeps}
          wsClient={wsClient}
        />
      </div>
      <Tabs defaultValue="outdated">
        <TabsList>
          <TabsTrigger value="outdated" data-testid="tab-outdated">
            Outdated{outdatedDeps.length > 0 ? ` (${outdatedDeps.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="unused" data-testid="tab-unused">
            Unused{unusedDeps.length > 0 ? ` (${unusedDeps.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="licenses" data-testid="tab-licenses">
            License Audit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="outdated">
          <OutdatedReport deps={outdatedDeps} hasRegistryData={hasRegistryData} />
        </TabsContent>

        <TabsContent value="unused">
          <UnusedReport deps={unusedDeps} hasImportAnalysis={hasImportAnalysis} />
        </TabsContent>

        <TabsContent value="licenses">
          <LicenseAudit licenses={licenseDistribution} hasRegistryData={hasRegistryData} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
