import {openAProject, test} from '../fixtures.js';

const APP_STATE = '/src/logic/appState.ts';

test('probe: new wizard project power', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.tb-btn[title*="New project"]').click();
  const modal = page.locator('.overlay.open');
  await modal.locator('button', { hasText: 'Next' }).click();
  await modal.locator('select').selectOption('sealed');
  await modal.locator('button', { hasText: 'Next' }).click();
  await modal.locator('button', { hasText: 'Pick Driver' }).click();
  await page.locator('.dlist .ditem').first().click();
  await page.locator('.use-btn').click();
  await page.waitForTimeout(300);
  const st = await page.evaluate(async (modPath) => {
    const p = (await import(/* @vite-ignore */ modPath)).requireFocusedProject();
    return { pin: p.powerDrive_W.value, tick: (await import(/* @vite-ignore */ '/src/logic/appState.ts')).projectChanged.value };
  }, APP_STATE);
  process.stdout.write('PROBE-NEWPIN ' + JSON.stringify(st) + '\n');
});