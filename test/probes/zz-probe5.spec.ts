import { test, openAProject } from '../fixtures.js';

const APP_STATE = '/src/logic/appState.ts';

test('probe2: filters reactivity', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.project-nav li', { hasText: 'Filters' }).click();
  await page.locator('.content-panel .filters-quickadd .action-btn').first().waitFor();
  const before = await page.evaluate(async (modPath) => {
    const S = await import(/* @vite-ignore */ modPath);
    return { ticks: S.projectChanged.value, n: S.requireFocusedProject().filters.get().length };
  }, APP_STATE);
  await page.locator('.action-btn', { hasText: '+ HP' }).click();
  await page.waitForTimeout(300);
  const after = await page.evaluate(async (modPath) => {
    const S = await import(/* @vite-ignore */ modPath);
    return { ticks: S.projectChanged.value, n: S.requireFocusedProject().filters.get().length };
  }, APP_STATE);
  const hintText = await page.locator('.filters-list .hint').count();
  const hint = hintText ? await page.locator('.filters-list .hint').textContent() : null;
  process.stdout.write('PROBE2-FILTERS ' + JSON.stringify({ before, after, hint }) + '\n');
});