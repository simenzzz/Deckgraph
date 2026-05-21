/**
 * Utilities for package action result handling.
 */

import type { PackageActionResult } from '@deckgraph/shared';

/**
 * Check whether a PackageActionResult matches the current operation context.
 * Used by action dialogs to show/hide results for the correct operation.
 */
export function isRelevantResult(
  result: PackageActionResult | null,
  action: PackageActionResult['action'],
  packageName: string,
  modulePath?: string,
): boolean {
  if (!result || result.packageName !== packageName || result.action !== action) {
    return false;
  }
  return modulePath ? result.modulePath === modulePath : true;
}
