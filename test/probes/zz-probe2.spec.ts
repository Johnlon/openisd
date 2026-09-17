import { test, openAProject } from '../fixtures.js';

const APP_STATE = '/src/logic/appState.ts';

test('probe: boxType set re-sync', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  await page.locator('select#og-box-type').selectOption('abc');
  const afterSel = await page.evaluate(async (modPath) => {
    const S = await import(/* @vite-ignore */ modPath);
    return {
      modelBoxType: S.requireFocusedProject().box.boxType.get(),
      ticks: S.projectChanged.value,
    };
  }, APP_STATE);
  await page.evaluate(async (modPath) => {
    const S = await import(/* @vite-ignore */ modPath);
    S.requireFocusedProject().box.boxType.set('sealed');
  }, APP_STATE);
  await page.waitForTimeout(400);
  const afterSet = await page.evaluate(async (modPath) => {
    const S = await import(/* @vite-ignore */ modPath);
    const p = S.requireFocusedProject();
    return {
      modelBoxType: p.box.boxType.get(),
      ticks: S.projectChanged.value,
      navCount: document.querySelectorAll('.project-nav li').length,
      diagramSealed: !!document.getElementById('og-box-diagram-sealed'),
      pending: !!document.querySelector('.pending-note'),
    };
  }, APP_STATE);
  process.stdout.write('PROBE-BOXTYPE ' + JSON.stringify({ afterSel, afterSet }) + '\n');
});