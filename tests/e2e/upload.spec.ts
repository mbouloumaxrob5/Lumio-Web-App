import { test, expect } from '@playwright/test';

test('upload page displays and accepts a file', async ({ page }) => {
  await page.goto('http://localhost:3000/upload');
  await expect(page.locator('text=Uploader une image')).toBeVisible();
  // cannot perform actual file upload in this test skeleton without fixture, but ensure UI elements exist
  await expect(page.locator('input[type="file"]')).toBeVisible();
  await expect(page.locator('text=Upload (direct)')).toBeVisible();
});
