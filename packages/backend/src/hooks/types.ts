/**
 * Hook system internal types.
 */

import type { HookEventType } from '@deckgraph/shared';

// Re-export for convenience
export type { HookEventType } from '@deckgraph/shared';

/**
 * Context passed to hook commands as environment variables.
 */
export interface HookContext {
  readonly event: HookEventType;
  readonly projectRoot: string;
  readonly data: HookEventData;
}

/**
 * Event-specific data passed to hooks.
 */
export type HookEventData =
  | ScanCompleteData
  | OutdatedData
  | UnusedData
  | LicenseViolationData;

/**
 * Data for scan-complete event.
 */
export interface ScanCompleteData {
  readonly type: 'scan-complete';
  readonly moduleCount: number;
  readonly depCount: number;
}

/**
 * Data for outdated event.
 */
export interface OutdatedData {
  readonly type: 'outdated';
  readonly count: number;
  readonly packages: readonly string[];
}

/**
 * Data for unused event.
 */
export interface UnusedData {
  readonly type: 'unused';
  readonly count: number;
  readonly packages: readonly string[];
}

/**
 * Data for license-violation event.
 */
export interface LicenseViolationData {
  readonly type: 'license-violation';
  readonly count: number;
  readonly packages: readonly string[];
}

/**
 * Callback to broadcast a message to all connected WebSocket clients.
 */
export type BroadcastFn = (message: import('@deckgraph/shared').NotificationMessage) => void;
