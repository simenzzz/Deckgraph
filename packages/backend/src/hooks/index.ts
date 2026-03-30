/**
 * Hooks module barrel exports.
 */

export { runHook, validateHookCommand, splitCommand } from './hookRunner.js';
export type { HookResult } from './hookRunner.js';
export { runHooksForEvent } from './notifier.js';
export type {
  HookContext,
  HookEventData,
  ScanCompleteData,
  OutdatedData,
  UnusedData,
  LicenseViolationData,
  BroadcastFn,
} from './types.js';
