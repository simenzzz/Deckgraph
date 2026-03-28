/**
 * E2E: Health Report tabs (outdated, unused, licenses).
 */

import { test, expect } from '@playwright/test';

test.describe('Health Report', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Scan Project' }).click();
    await expect(page.getByRole('button', { name: /^npm:/i })).toBeVisible({
      timeout: 30_000,
    });
  });

  test('should navigate to health report', async ({ page }) => {
    await page.getByTestId('nav-health').click();
    await expect(page.getByTestId('health-report')).toBeVisible();
  });

  test('should show outdated tab by default', async ({ page }) => {
    await page.getByTestId('nav-health').click();
    await expect(page.getByTestId('tab-outdated')).toBeVisible();
  });

  test('should switch between tabs', async ({ page }) => {
    await page.getByTestId('nav-health').click();

    await page.getByTestId('tab-unused').click();
    // Unused report or "no analysis" message should be visible
    const unusedContent = page.getByTestId('unused-report').or(page.getByTestId('unused-no-analysis'));
    await expect(unusedContent).toBeVisible();

    await page.getByTestId('tab-licenses').click();
    const licenseContent = page.getByTestId('license-audit').or(page.getByTestId('license-no-data'));
    await expect(licenseContent).toBeVisible();
  });
});
