/**
 * E2E: File watcher — edit a manifest and observe UI auto-update.
 *
 * NOTE: This test requires running the server with --watch enabled
 * against a temp copy of the fixture. It is designed to be run manually
 * or in a CI pipeline that supports filesystem writes. Skip in the
 * default webServer config (which uses --no-watch).
 */

import { test, expect } from '@playwright/test';

test.describe('File Watcher', () => {
  // The default playwright.config.ts starts the server with --no-watch,
  // so file watcher tests are skipped by default. To enable, run with
  // a custom config that starts the server with watching enabled.
  test.skip(true, 'File watcher tests require --watch enabled server');

  test('should detect manifest changes and update UI', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Scan Project' }).click();
    await expect(page.getByRole('button', { name: /npm:/i })).toBeVisible({
      timeout: 30_000,
    });

    // This would modify a manifest in the temp fixture copy and
    // wait for the UI to reflect the changes. Implementation deferred
    // until CI infrastructure supports filesystem write + watch flow.
  });
});
