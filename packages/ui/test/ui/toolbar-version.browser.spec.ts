import { test, expect } from '../fixtures.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const COMPLETE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'complete-driver-project.owpr');
// The build (scripts/version-info.mjs → packages/ui/public/build-info.json) is the on-disk source
// of truth for the toolbar version. The dev/preview server serves THAT file at /build-info.json,
// so this assertion proves the app shows exactly what the last build wrote.
const BUILD_INFO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'build-info.json');

test('toolbar shows the exact version stored in build-info.json', async ({ page }) => {
  const onDisk = JSON.parse(readFileSync(BUILD_INFO, 'utf8')) as { version: string };
  expect(onDisk.version).toMatch(/^v\d{8}T\d{6}Z$/);

  await page.goto('/');
  await page.locator('.original-root input[type=file]').setInputFiles({ name: 'project.owpr', mimeType: 'application/json', buffer: readFileSync(COMPLETE) });
  await page.locator('.original-root').waitFor({ state: 'visible' });

  const chip = page.locator('.version-chip');
  await expect(chip).toHaveText(onDisk.version);

  // Layout contract (John 2026-09-13): the version sits IN THE MIDDLE OF THE TOOLBAR —
  // one row: window buttons far left, the version centred in the gap between the two
  // clusters, frequency selector far right. A version stranded on its own row above the
  // controls is a regression.
  const chipBox = await chip.boundingBox();
  const barBox = await page.locator('.toolbar').boundingBox();
  const barCentre = barBox!.x + barBox!.width / 2;
  const chipCentre = chipBox!.x + chipBox!.width / 2;
  expect(Math.abs(chipCentre - barCentre)).toBeLessThan(4);

  const font = await chip.evaluate((el) => getComputedStyle(el).fontSize);
  expect(parseFloat(font)).toBeGreaterThanOrEqual(20);

  const icons = await page.locator('.tb-icons').boundingBox();
  const readout = await page.locator('.cursor-readout').boundingBox();

  // Same row, not above it: the chip shares the buttons' vertical band.
  expect(Math.abs(chipBox!.y - icons!.y)).toBeLessThanOrEqual(4);

  // Single-row toolbar: one row of controls, never a second row added for the chip.
  expect(barBox!.height).toBeLessThan(60);

  // Frequency selector lives at the far RIGHT, on the other side of the chip.
  expect(readout!.x).toBeGreaterThan(chipCentre);
});
