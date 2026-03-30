/**
 * Hook execution coordinator.
 *
 * Runs hooks for specific events and broadcasts results to clients.
 */

import { randomUUID } from 'node:crypto';
import type {
  HooksConfig,
  NotificationMessage,
} from '@deckgraph/shared';
import type {
  HookContext,
  HookEventType,
  BroadcastFn,
} from './types.js';
import { runHook } from './hookRunner.js';
import { createLogger } from '../logger.js';

const logger = createLogger('notifier');

/**
 * Run all hooks configured for an event.
 *
 * - Executes hooks sequentially (not in parallel)
 * - Converts each result to a NotificationMessage
 * - Broadcasts to all connected clients
 * - Continues on failure (logs errors, sends warning notifications)
 *
 * @param hooksConfig Hook configuration from workspace config
 * @param event Event type to trigger hooks for
 * @param context Context data for the hook execution
 * @param broadcast Callback to send notifications to clients
 */
export async function runHooksForEvent(
  hooksConfig: HooksConfig,
  event: HookEventType,
  context: HookContext,
  broadcast: BroadcastFn,
): Promise<void> {
  let hooks: readonly import('@deckgraph/shared').HookEntry[];

  switch (event) {
    case 'on-scan-complete':
      hooks = hooksConfig.onScanComplete;
      break;
    case 'on-outdated':
      hooks = hooksConfig.onOutdated;
      break;
    case 'on-unused':
      hooks = hooksConfig.onUnused;
      break;
    case 'on-license-violation':
      hooks = hooksConfig.onLicenseViolation;
      break;
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }

  // No hooks configured for this event
  if (hooks.length === 0) {
    logger.debug({ event }, 'No hooks configured for event');
    return;
  }

  logger.info({ event, hookCount: hooks.length }, 'Running hooks for event');

  // Run hooks sequentially
  for (let i = 0; i < hooks.length; i++) {
    const hook = hooks[i]!;
    const hookIndex = i + 1;

    try {
      const result = await runHook(hook, context);

      const notification = buildNotification(
        event,
        hook.cmd,
        result,
        hookIndex,
        hooks.length,
      );

      broadcast(notification);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'unknown error';
      logger.error(
        { event, hookCmd: hook.cmd, error: detail },
        'Hook execution failed',
      );

      // Send a warning notification for the failure
      const failureNotification: NotificationMessage = {
        type: 'notification',
        requestId: `hook-${event}-${randomUUID()}`,
        severity: 'warning',
        title: `Hook ${hookIndex}/${hooks.length} failed`,
        body: `Command "${hook.cmd}" failed: ${detail}`,
        timestamp: new Date().toISOString(),
      };

      broadcast(failureNotification);
    }
  }
}

/**
 * Build a notification message from hook execution result.
 */
function buildNotification(
  event: HookEventType,
  cmd: string,
  result: import('./hookRunner.js').HookResult,
  index: number,
  total: number,
): NotificationMessage {
  const severity = result.success ? 'info' : 'warning';
  const title = `Hook ${index}/${total} ${result.success ? 'succeeded' : 'failed'}`;

  const parts = [
    `Command: ${cmd}`,
    `Duration: ${result.durationMs}ms`,
  ];
  if (result.exitCode !== null) parts.push(`Exit code: ${result.exitCode}`);
  if (result.stdout) parts.push(`\nOutput:\n${result.stdout}`);
  if (result.stderr) parts.push(`\nErrors:\n${result.stderr}`);
  const body = parts.join('\n');

  return {
    type: 'notification',
    requestId: `hook-${event}-${randomUUID()}`,
    severity,
    title,
    body,
    timestamp: new Date().toISOString(),
  };
}
