import {openAProject, test} from '../fixtures.js';

const PRES = '/src/logic/presentationState.ts';

test('probe: pin cursor', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  const chart = page.locator('.graph-wrap .gpanel canvas').first();
  await chart.waitFor();
  const box = (await chart.boundingBox())!;
  process.stdout.write('CANVAS-BOX ' + JSON.stringify(box) + '\n');
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.waitForTimeout(200);
  const afterMove = await page.evaluate(async (mp) => {
    const s = await import(/* @vite-ignore */ mp);
    return { cursorF: s.presentationState.cursorF, pinnedF: s.presentationState.pinnedF, locked: s.presentationState.cursorLocked };
  }, PRES);
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.waitForTimeout(200);
  const afterClick = await page.evaluate(async (mp) => {
    const s = await import(/* @vite-ignore */ mp);
    return { cursorF: s.presentationState.cursorF, pinnedF: s.presentationState.pinnedF, locked: s.presentationState.cursorLocked };
  }, PRES);
  const readout = (await page.locator('.cursor-readout .ro-hz').textContent())!.trim();
  process.stdout.write('PROBE-PIN ' + JSON.stringify({ afterMove, afterClick, readout }) + '\n');
});