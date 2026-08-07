/* eslint-disable playwright/no-wait-for-timeout --
   This file is a FRAME RECORDER, not a test: it drives the UI and writes screenshots
   for a walkthrough animation. The pauses are the capture interval — the thing being
   waited for is "the UI has settled enough to photograph", which no DOM condition
   expresses. Every real spec still uses waitForFunction; the rule stands everywhere else. */
import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test('record UI browser automation frames in Original WinISD skin', async ({ page }) => {
  const framesDir = '/tmp/ui_frames';
  if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir, { recursive: true });

  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');

  // Select Original skin
  await page.locator('.skin-picker select').selectOption('original');
  await page.locator('.original-root').waitFor({ state: 'visible' });

  // Open Driver Editor Modal via store composable
  await page.evaluate(async () => {
    // Specifier in a variable on purpose — this import runs in the PAGE, where vite serves
    // the path; a literal makes tsc try to resolve it against the filesystem and fail.
    const spec = '/src/composables/useDriverSelection.ts';
    const mod = await import(/* @vite-ignore */ spec);
    mod.editProjectDriver();
  });

  await page.locator('.de-body').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Parameters', exact: true }).click();
  await page.waitForTimeout(500);

  // Frame 0: Initial state in Original skin
  await page.screenshot({ path: path.join(framesDir, 'frame_00.png') });

  // Frame 1: Clear Hc & enter Hg = 8.0
  const hcf = page.locator('.de-fld:has-text("Hc") input');
  const hgf = page.locator('.de-fld:has-text("Hg") input');
  const xmaxf = page.locator('.de-fld:has-text("Xmax") input');

  await hcf.fill('');
  await hgf.fill('8.0');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(framesDir, 'frame_01.png') });

  // Frame 2: Enter Xmax = 3.0 (Hc calculates to 2.00 mm green)
  await xmaxf.fill('3.0');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(framesDir, 'frame_02.png') });

  // Frame 3: Enter Dd = 210.0 (Sd calculates to 346.4 cm² green)
  const ddf = page.locator('.de-fld:has-text("Dd") input');
  await ddf.fill('210.0');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(framesDir, 'frame_03.png') });

  // Frame 4: Enter Fs=35, Qes=0.4, Qms=4.5, Vas=45, Re=6 (Multi-hop cascade)
  await page.locator('.de-fld:has-text("Fs") input').fill('35.0');
  await page.locator('.de-fld:has-text("Qes") input').fill('0.400');
  await page.locator('.de-fld:has-text("Qms") input').fill('4.500');
  await page.locator('.de-fld:has-text("Vas") input').fill('45.0');
  await page.locator('.de-fld:has-text("Re") input').fill('6.0');
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(framesDir, 'frame_04.png') });
});
