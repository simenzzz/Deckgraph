/**
 * Shared fixture for starting a deckgraph server in E2E tests.
 *
 * Provides a helper to connect a WebSocket client and send/receive
 * messages for test assertions.
 */

import { test as base, type Page } from '@playwright/test';

/**
 * Send a scan_project message via the WebSocket and wait for the
 * project_overview response to appear in the UI.
 */
export async function triggerScan(page: Page): Promise<void> {
  // Click the "Scan Project" button (shown on initial load before any scan)
  const scanButton = page.getByRole('button', { name: /scan/i });
  await scanButton.click();

  // Wait for the overview to load (ecosystem cards appear)
  await page.waitForSelector('[data-testid="ecosystem-card"]', {
    timeout: 30_000,
  });
}

/**
 * Navigate to a specific view via the sidebar.
 */
export async function navigateTo(
  page: Page,
  view: 'Overview' | 'Explorer' | 'Health' | 'Cross-Language',
): Promise<void> {
  await page.getByRole('button', { name: view }).click();
}

export const test = base;
export { expect } from '@playwright/test';
