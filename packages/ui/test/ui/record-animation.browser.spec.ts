import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { test, expect, openAProject } from '../fixtures.js';
import { typeInto } from '../fixtures/numField.js';

test('record UI browser automation frames in Original WinISD skin', async ({ page }) => {
  // Repo-local build/, never an OS temp path — AGENTS.md §"Scratch files".
  const framesDir = fileURLToPath(new URL('../../../../build/ui_frames', import.meta.url));
  fs.mkdirSync(framesDir, { recursive: true });  // recursive:true already tolerates an existing dir

  await page.goto('/');
  await openAProject(page);

  // Original is the only shell, so there is nothing to select — just wait for it.
  await page.locator('.original-root').waitFor({ state: 'visible' });

  // Open the Driver Editor the way a user does. Services are constructed by the composition
  // root and injected, so there is no module-level instance to import and call.
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.edit-btn', { hasText: 'Edit' }).click();

  await page.locator('.de-body').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Parameters', exact: true }).click();

  // Frame 0: Initial state in Original skin
  await page.screenshot({ path: path.join(framesDir, 'frame_00.png') });

  // Frame 1: Clear Hc & enter Hg = 8.0
  const hcf = page.locator('.de-fld:has-text("Hc") input');
  const hgf = page.locator('.de-fld:has-text("Hg") input');
  const xmaxf = page.locator('.de-fld:has-text("Xmax") input');

  await typeInto(hcf, '');
  await typeInto(hgf, '8.0');
  await expect(hgf).toHaveValue('8.0'); // real keystrokes echo the raw string while typing
  await page.screenshot({ path: path.join(framesDir, 'frame_01.png') });

  // Frame 2: Enter Xmax = 3.0 (Hc calculates to 2.00 mm green)
  await typeInto(xmaxf, '3.0');
  await expect(xmaxf).toHaveValue('3.0');
  await page.screenshot({ path: path.join(framesDir, 'frame_02.png') });

  // Frame 3: Enter Dd = 210.0 (Sd calculates to 346.4 cm² green)
  const ddf = page.locator('.de-fld:has-text("Dd") input');
  await typeInto(ddf, '210.0');
  await expect(ddf).toHaveValue('210.0');
  await page.screenshot({ path: path.join(framesDir, 'frame_03.png') });

  // Frame 4: Enter Fs=35, Qes=0.4, Qms=4.5, Vas=45, Re=6 (Multi-hop cascade)
  await typeInto(page.locator('.de-fld:has-text("Fs") input'), '35.0');
  await typeInto(page.locator('.de-fld:has-text("Qes") input'), '0.400');
  await typeInto(page.locator('.de-fld:has-text("Qms") input'), '4.500');
  await typeInto(page.locator('.de-fld:has-text("Vas") input'), '45.0');
  const reInput = page.locator('.de-fld:has-text("Re") input');
  await typeInto(reInput, '6.0');
  await expect(reInput).toHaveValue('6.0');
  await page.screenshot({ path: path.join(framesDir, 'frame_04.png') });

  // A recorder that photographed a closed editor would write five useless frames and still
  // "pass", so the run states what every frame was supposed to contain.
  await expect(page.locator('.de-body')).toBeVisible();
  expect(fs.readdirSync(framesDir).filter(f => /^frame_\d\d\.png$/.test(f)).sort())
    .toEqual(['frame_00.png', 'frame_01.png', 'frame_02.png', 'frame_03.png', 'frame_04.png']);
});
