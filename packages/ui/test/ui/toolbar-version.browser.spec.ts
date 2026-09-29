import {expect, test} from '../fixtures.js';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

import {COMPLETE_DRIVER_PROJECT_OWPR, ensureSampleProject} from '../fixtures/sampleProject.js';

ensureSampleProject();
const COMPLETE = COMPLETE_DRIVER_PROJECT_OWPR;
// The build (scripts/version-info.mjs → packages/ui/public/build-info.json) is the on-disk source
// of truth for the toolbar version. The dev/preview server serves THAT file at /build-info.json,
// so this assertion proves the app shows exactly what the last build wrote.
const BUILD_INFO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'build-info.json');

function isBuildInfo(v: unknown): v is { version: string } {
  return typeof v === 'object' && v !== null && 'version' in v && typeof v.version === 'string';
}

function readBuildInfo(): { version: string } {
  const parsed: unknown = JSON.parse(readFileSync(BUILD_INFO, 'utf8'));
  if (!isBuildInfo(parsed)) throw new Error(`build-info.json has no string "version": ${JSON.stringify(parsed)}`);
  return parsed;
}

test('toolbar shows the exact version stored in build-info.json', async ({ page }) => {
  const onDisk = readBuildInfo();
  expect(onDisk.version).toMatch(/^v\d{8}T\d{6}Z$/);

  await page.goto('/');
  await page.locator('.original-root input[type=file]').setInputFiles({ name: 'project.owpr', mimeType: 'application/json', buffer: readFileSync(COMPLETE) });
  await page.locator('.original-root').waitFor({ state: 'visible' });

  const brand = page.locator('.app-brand');
  await expect(brand).toContainText('OpenISD');
  await expect(brand.locator('.version-chip')).toHaveText(`(${onDisk.version})`);
  // The brand icon renders either from the public /icon.svg or inline as a data-URI SVG
  // (the shell embeds the loudspeaker mark directly) — assert the icon exists and is SVG.
  await expect(brand.locator('img')).toHaveAttribute('src', /^data:image\/svg\+xml|\/icon\.svg$/);

  // Layout contract: one row — window buttons and chart menu left, then the version, then
  // the frequency selector right, none painting over another. A version stranded on its own
  // row is a regression. (John 2026-09-29: the version need not be centred — the chart menu
  // is wider than half the bar at 1280 px, so centring it overlapped the icons.)
  const barBox = await page.locator('.toolbar').boundingBox();
  expect(barBox!.height).toBeLessThan(60);
  const brandBox = await brand.boundingBox();
  const icons = await page.locator('.tb-icons').boundingBox();
  const readout = await page.locator('.cursor-readout').boundingBox();
  const menu = await page.locator('.chart-select').boundingBox();
  expect(menu!.x + menu!.width).toBeLessThanOrEqual(icons!.x + icons!.width + 1);
  expect(icons!.x + icons!.width).toBeLessThanOrEqual(brandBox!.x);
  expect(brandBox!.x + brandBox!.width).toBeLessThanOrEqual(readout!.x);
});
