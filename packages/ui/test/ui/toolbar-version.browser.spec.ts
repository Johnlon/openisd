import {expect, test} from '../fixtures.js';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

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

  const brand = page.locator('.app-brand');
  await expect(brand).toContainText('OpenISD');
  await expect(brand.locator('.version-chip')).toHaveText(`(${onDisk.version})`);
  // The brand icon renders either from the public /icon.svg or inline as a data-URI SVG
  // (the shell embeds the loudspeaker mark directly) — assert the icon exists and is SVG.
  await expect(brand.locator('img')).toHaveAttribute('src', /^data:image\/svg\+xml|\/icon\.svg$/);

  // Layout contract (John 2026-09-13): the version sits IN THE MIDDLE OF THE TOOLBAR —
  // one row: window buttons far left, the version centred in the gap between the two
  // clusters, frequency selector far right. A version stranded on its own row above the
  // controls is a regression.
  const barBox = await page.locator('.toolbar').boundingBox();
  expect(barBox!.height).toBeLessThan(60);
  const brandBox = await brand.boundingBox();
  const brandCentre = brandBox!.x + brandBox!.width / 2;
  const barCentre = barBox!.x + barBox!.width / 2;
  expect(Math.abs(brandCentre - barCentre)).toBeLessThan(4);
  const icons = await page.locator('.tb-icons').boundingBox();
  const readout = await page.locator('.cursor-readout').boundingBox();
  expect(icons!.x + icons!.width).toBeLessThan(brandCentre);
  expect(readout!.x).toBeGreaterThan(brandCentre);
});
