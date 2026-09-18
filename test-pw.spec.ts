import { test, expect } from '@playwright/test';
test('test', async ({ page }) => {
  await page.goto('http://localhost:4100/');
  const status = await page.locator('.status').textContent();
  console.log(status);
});
