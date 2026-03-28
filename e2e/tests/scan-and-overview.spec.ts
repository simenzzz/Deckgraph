/**
 * E2E: Scan the polyglot fixture and verify the overview page.
 */

import { test, expect } from '@playwright/test';

test.describe('Scan and Overview', () => {
  test('should show scan prompt on initial load', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('No project scanned')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Scan Project' })).toBeVisible();
  });

  test('should scan project and show ecosystem cards', async ({ page }) => {
    await page.goto('/');

    // Wait for WebSocket connection
    await page.waitForTimeout(500);

    // Trigger scan
    await page.getByRole('button', { name: 'Scan Project' }).click();

    // Wait for overview to render — use aria-label which includes ecosystem name
    await expect(page.getByRole('button', { name: /^npm:/i })).toBeVisible({
      timeout: 30_000,
    });

    // Verify multiple ecosystems detected (use ^ anchor to avoid partial matches)
    await expect(page.getByRole('button', { name: /^pypi:/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Go:/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Cargo:/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Maven:/i })).toBeVisible();

    // Verify "Project Overview" heading
    await expect(page.getByText('Project Overview')).toBeVisible();
  });

  test('should show correct module counts after scan', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Scan Project' }).click();

    // Wait for npm card — it should have 2 modules (api-gateway + shared-types)
    const npmCard = page.getByRole('button', { name: /^npm:.*2 module/i });
    await expect(npmCard).toBeVisible({ timeout: 30_000 });

    // pypi should have 2 modules (auth-service + ml-pipeline)
    await expect(page.getByRole('button', { name: /^pypi:.*2 module/i })).toBeVisible();
  });
});
