import { test, openAProject } from '../fixtures.js';

const APP_STATE = '/src/logic/appState.ts';

test('probe3: filters render search', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.project-nav li', { hasText: 'Filters' }).click();
  await page.locator('.content-panel .filters-quickadd .action-btn').first().waitFor();
  const tabsWithFilters = await page.evaluate(() => {
    const out: { cls: string; rows: number; hint: number }[] = [];
    document.querySelectorAll('.filters-list').forEach((el) => {
      const rows = el.querySelectorAll('.filter-row-inline').length;
      const hint = el.querySelectorAll('.hint').length;
      out.push({ cls: el.className, rows, hint });
    });
    return out;
  });
  await page.locator('.action-btn', { hasText: '+ HP' }).click();
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => {
    const out: { cls: string; rows: number; hint: number; sections: number }[] = [];
    document.querySelectorAll('.filters-list').forEach((el) => {
      out.push({
        cls: el.className,
        rows: el.querySelectorAll('.filter-row-inline').length,
        hint: el.querySelectorAll('.hint').length,
        sections: el.closest('[class*=tab-section]') ? 1 : 0,
      });
    });
    return out;
  });
  process.stdout.write('PROBE3-FILTERS ' + JSON.stringify({ tabsWithFilters, after }) + '\n');
});