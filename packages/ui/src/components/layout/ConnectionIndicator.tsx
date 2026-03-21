/**
 * Connection status indicator dot with tooltip.
 */

import { useConnectionStore } from '@/stores';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ConnectionStatus } from '@/lib/wsClient';

const statusConfig: Record<ConnectionStatus, { color: string; label: string }> = {
  connected: { color: 'bg-green-500', label: 'Connected' },
  connecting: { color: 'bg-yellow-500 animate-pulse', label: 'Connecting...' },
  reconnecting: { color: 'bg-yellow-500 animate-pulse', label: 'Reconnecting...' },
  disconnected: { color: 'bg-red-500', label: 'Disconnected' },
};

export function ConnectionIndicator() {
  const status = useConnectionStore((s) => s.status);
  const config = statusConfig[status];

  return (
    <Tooltip content={config.label}>
      <div className="flex items-center gap-2">
        <div
          className={cn('h-2.5 w-2.5 rounded-full', config.color)}
          aria-label={config.label}
          data-testid="connection-indicator"
        />
        <span className="text-xs text-muted-foreground">{config.label}</span>
      </div>
    </Tooltip>
  );
}
