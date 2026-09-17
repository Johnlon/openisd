import { test, openAProject } from '../fixtures.js';

const APP_STATE = '/src/logic/appState.ts';

test('probe: filters quick-add', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.project-nav li', { hasText: 'Filters' }).click();
  const panel = page.locator('.content-panel');
  await panel.locator('.filters-quickadd .action-btn').first().waitFor();
  const count6 = await panel.locator('.filters-quickadd .action-btn').count();
  await panel.locator('.action-btn', { hasText: '+ HP' }).click();
  await page.waitForTimeout(300);
  const modelCount = await page.evaluate(async (modPath) => {
    const p = (await import(/* @vite-ignore */ modPath)).requireFocusedProject();
    return p.filters.get().length;
  }, APP_STATE);
  const rows = await panel.locator('.filters-list .filter-row-inline').count();
  const hints = await panel.locator('.filters-list .hint').count();
  process.stdout.write('PROBE-FILTERS ' + JSON.stringify({ count6, modelCount, rows, hints }) + '\n');
});