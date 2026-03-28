/**
 * E2E: Cross-Language Graph view.
 */

import { test, expect } from '@playwright/test';

test.describe('Cross-Language Graph', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Scan Project' }).click();
    await expect(page.getByRole('button', { name: /^npm:/i })).toBeVisible({
      timeout: 30_000,
    });
  });

  test('should navigate to graph view', async ({ page }) => {
    await page.getByTestId('nav-graph').click();
    await expect(page.getByTestId('cross-language-graph')).toBeVisible();
  });

  test('should show graph canvas', async ({ page }) => {
    await page.getByTestId('nav-graph').click();
    await expect(page.getByTestId('graph-canvas')).toBeVisible();
  });

  test('should show edge filter controls', async ({ page }) => {
    await page.getByTestId('nav-graph').click();
    await expect(page.getByTestId('cross-edge-filter')).toBeVisible();
  });
});
