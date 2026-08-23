/**
 * The QO81 failure surfaces (docs/design/MY_DRIVERS_STORAGE_FAILURES.md, D21):
 * the corrupted-bucket BLOCKING modal (no cancel, Export + challenged Delete), the broken-row
 * treatment (preserved, surfaced by name, per-entry Export + challenged Delete), and the
 * rename question on a name-changing save.
 *
 * Written under the one-suite rule to EXECUTE in the endgame frozen-tree Playwright batch.
 */
import { test, expect } from '../fixtures.js';
import type { Page } from '@playwright/test';

const MY_DRIVERS_KEY = 'openisd_my_drivers';

/** A conforming record with a chosen uuid, in the CURRENT envelope's vocabulary. */
function record(uuid: string, brand: string, model: string): Record<string, unknown> {
  const spec = (v: number) => ({ origin: 'manual', readings: { manual: { read_value: v } }, dq: [] });
  return {
    uuid: { value: uuid, definition: 'stable record identity' },
    quality: { rating: 'L', confirmed_fields: [], fields_with_issues: [], missing: [],
      invalid: [], parse_errors: [], cross_source_only: [] },
    manufacturer: { value: brand, origin: 'manual', definition: 'x', dq: [] },
    brand: { value: brand, origin: 'manual', definition: 'x', dq: [] },
    model: { value: model, origin: 'manual', definition: 'x', dq: [] },
    sku: { value: `${brand}-${model}`.toLowerCase(), definition: 'x', grounds: [] },
    driver_type: { value: 'woofer', origin: 'manual', definition: 'x', dq: [] },
    data_sources: { value: {}, definition: 'x' },
    authoritative: { value: 'manual', definition: 'x' },
    specs: { woofer: { Fs: spec(41), Re: spec(5.4), Sd: spec(0.0132), Qts: spec(0.35), Qes: spec(0.38) } },
  };
}

async function seedRaw(page: Page, raw: string): Promise<void> {
  await page.addInitScript(([value, key]) => {
    localStorage.setItem('openisd.state', JSON.stringify({ ui: { skin: 'original' } }));
    localStorage.setItem(key as string, value as string);
  }, [raw, MY_DRIVERS_KEY] as const);
  await page.goto('/');
}

async function openPicker(page: Page): Promise<void> {
  await page.locator('[title*="librar" i]').first().click();
  await expect(page.locator('.dlist')).toBeVisible();
}

test('a corrupted bucket raises the blocking modal: no cancel, Export, challenged Delete', async ({ page }) => {
  await seedRaw(page, '{"schema": 2, "drivers": NOT-VALID-JSON');
  await openPicker(page);

  const modal = page.locator('.my-storage-modal');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('cannot be read');
  // no dismissal control of any kind
  await expect(modal.locator('button')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(modal).toBeVisible();

  // Delete challenges an un-exported session: first press arms, does not delete
  await modal.locator('.my-delete-all').click();
  await expect(modal).toContainText('destroys the only copy');
  const stillStored = await page.evaluate(k => localStorage.getItem(k as string), MY_DRIVERS_KEY);
  expect(stillStored).toContain('NOT-VALID-JSON');

  // second press deletes and starts fresh
  await modal.locator('.my-delete-all').click();
  await expect(modal).toBeHidden();
  const after = await page.evaluate(k => localStorage.getItem(k as string), MY_DRIVERS_KEY);
  expect(after).toContain('"drivers":[]');
});

test('Export downloads the raw string verbatim and disarms the delete challenge', async ({ page }) => {
  const corrupt = '{"schema": 2, "drivers": [BROKEN';
  await seedRaw(page, corrupt);
  await openPicker(page);
  const modal = page.locator('.my-storage-modal');
  await expect(modal).toBeVisible();

  const download = page.waitForEvent('download');
  await modal.locator('.my-export-raw').click();
  const file = await download;
  expect(await (await file.createReadStream()).toArray().then(a => Buffer.concat(a).toString()))
    .toBe(corrupt);

  // exported this session: Delete acts on the FIRST press now
  await modal.locator('.my-delete-all').click();
  await expect(modal).toBeHidden();
});

test('a broken entry is preserved, surfaced by name, and its Delete removes only it', async ({ page }) => {
  const broken = { brand: { value: 'Ghost' }, model: { value: 'Blob' }, halfARecord: true };
  await seedRaw(page, JSON.stringify({ schema: 2, drivers: [broken, record('u-ok', 'Good', 'One')] }));
  await openPicker(page);

  const row = page.locator('.my-broken-row');
  await expect(row).toBeVisible();
  await expect(row).toContainText('Ghost Blob');
  await expect(page.locator('.my-ditem')).toContainText('Good One');

  // challenged delete: arm, then act
  await row.locator('.my-broken-del').click();
  await expect(row.locator('.my-broken-del')).toContainText('WITHOUT exporting');
  await row.locator('.my-broken-del').click();
  await expect(page.locator('.my-broken-row')).toHaveCount(0);

  const stored = await page.evaluate(k => localStorage.getItem(k as string), MY_DRIVERS_KEY);
  expect(stored).toContain('Good');
  expect(stored).not.toContain('Ghost');
});

test('a name-changing save asks the ONE question; Save as a copy keeps the original', async ({ page }) => {
  await seedRaw(page, JSON.stringify({ schema: 2, drivers: [record('u-edit', 'Orig', 'Name')] }));
  await openPicker(page);

  await page.locator('.my-ditem .my-edit').click();
  await expect(page.locator('.de-root, [aria-label*="driver" i]').first()).toBeVisible();
  // change the model, then Save through the save dialog
  const model = page.locator('input.save-model-input');
  await page.locator('button', { hasText: /^Save/ }).first().click();
  await expect(model).toBeVisible();
  await model.fill('Renamed');
  await page.locator('.save-confirm-btn').click();

  const question = page.locator('.de-rename-panel');
  await expect(question).toBeVisible();
  await expect(question).toContainText('brand or model');
  await question.locator('.save-as-copy-btn').click();

  const stored = await page.evaluate(k => localStorage.getItem(k as string), MY_DRIVERS_KEY);
  const parsed = JSON.parse(stored!) as { drivers: { model: { value: string } }[] };
  expect(parsed.drivers).toHaveLength(2);
  const models = parsed.drivers.map(d => d.model.value).sort();
  expect(models).toEqual(['Name', 'Renamed']);
});

test('importing the same driver file twice through the real path yields two entries (S1)', async ({ page }) => {
  // The mint-fresh rule LIVES in driverBrowsingState.loadFromDisk — this exercises it
  // through the actual file input, not the repo given a correct caller.
  await seedRaw(page, JSON.stringify({ schema: 2, drivers: [] }));
  await openPicker(page);

  const wdr = [
    '[Driver]', 'Brand=Twice', 'Model=Imported', 'Manufacturer=', 'ProvidedBy=', 'Comment=',
    'DateAdded=', 'DateModified=', 'Qts=0.4', 'Fs=40', 'Re=6', 'ParState=' + 'N'.repeat(49), '',
  ].join('\r\n');
  const file = { name: 'twice.wdr', mimeType: 'text/plain', buffer: Buffer.from(wdr) };

  for (let i = 0; i < 2; i++) {
    await page.locator('button', { hasText: /load.*disk|from disk/i }).first().click().catch(() => {});
    await page.locator('input[type="file"]').setInputFiles(file);
    await expect(page.locator('.my-ditem')).toHaveCount(i + 1);
  }

  const stored = await page.evaluate(k => localStorage.getItem(k as string), MY_DRIVERS_KEY);
  const parsed = JSON.parse(stored!) as { drivers: { uuid: { value: string } }[] };
  expect(parsed.drivers).toHaveLength(2);
  expect(parsed.drivers[0]!.uuid.value).not.toBe(parsed.drivers[1]!.uuid.value);
});
