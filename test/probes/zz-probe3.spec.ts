import {openAProject, test} from '../fixtures.js';

const APP_STATE = '/src/logic/appState.ts';
const PRES = '/src/logic/presentationState.ts';

test('probe: wizard vented box type', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.tb-btn[title*="New project"]').click();
  const modal = page.locator('.overlay.open');
  await modal.locator('button', { hasText: 'Next' }).click();
  const selCount = await modal.locator('select').count();
  const options = await modal.locator('select').locator('option').allTextContents();
  await modal.locator('select').selectOption('vented');
  const valAfterSel = await modal.locator('select').inputValue();
  await modal.locator('button', { hasText: 'Next' }).click();
  await modal.locator('input').first().fill('42');
  await modal.locator('button', { hasText: 'Pick Driver' }).click();
  await page.waitForTimeout(500);
  const st = await page.evaluate(async (store, pres) => {
    const s = await import(/* @vite-ignore */ store);
    const ps = await import(/* @vite-ignore */ pres);
    const project = s.requireFocusedProject();
    return { box: project.box.boxType.get(), vb: project.box.vented.volume_m3.value, browse: ps.presentationState.browseOpen };
  }, APP_STATE, PRES);
  process.stdout.write('PROBE-WIZARD ' + JSON.stringify({ selCount, options, valAfterSel, st }) + '\n');
});