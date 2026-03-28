/**
 * E2E: Module Explorer navigation and filtering.
 */

import { test, expect } from '@playwright/test';

test.describe('Module Explorer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Scan Project' }).click();
    await expect(page.getByRole('button', { name: /^npm:/i })).toBeVisible({
      timeout: 30_000,
    });
  });

  test('should navigate to explorer via sidebar', async ({ page }) => {
    await page.getByTestId('nav-explorer').click();
    await expect(page.getByRole('heading', { name: 'Module Explorer' })).toBeVisible();
  });

  test('should navigate to explorer by clicking ecosystem card', async ({ page }) => {
    await page.getByRole('button', { name: /^npm:/i }).click();
    await expect(page.getByRole('heading', { name: 'Module Explorer' })).toBeVisible();
  });

  test('should show module list with dependencies', async ({ page }) => {
    await page.getByTestId('nav-explorer').click();

    // Module card should be visible via data-testid
    await expect(page.getByTestId('module-services/api-gateway')).toBeVisible({ timeout: 5_000 });
  });
});
