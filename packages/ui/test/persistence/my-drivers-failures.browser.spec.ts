import { test, expect, openAProject } from '../fixtures.js';
import { deviceRecord } from '../fixtures/seedMyDrivers.js';
import type { Page } from '@playwright/test';

const MY_DRIVERS_KEY = 'openisd_my_drivers';

/** One stored slot in the CURRENT envelope: { uuid, record }, the record a conforming
 *  OpenISDDeviceJson. Built through the shared `deviceRecord` so it stays a shape the repo
 *  actually opens, and the record's own uuid matches the slot uuid. */
function slot(uuid: string, brand: string, model: string): { uuid: string; record: unknown } {
  return {
    uuid,
    record: deviceRecord(
      { brand, model, specs: { Fs_hz: 41, Re_ohm: 5.4, Sd_m2: 0.0132, Qts: 0.35, Qes: 0.38 } },
      uuid,
    ),
  };
}

/** The current-shape envelope string for a set of good slots. */
function bucket(...slots: { uuid: string; record: unknown }[]): string {
  return JSON.stringify({ schema: 1, entries: slots });
}

async function seedRaw(page: Page, raw: string): Promise<void> {
  await page.addInitScript(([value, key]) => {
    localStorage.setItem(key as string, value as string);
  }, [raw, MY_DRIVERS_KEY] as const);
  await page.goto('/');
  await openAProject(page);
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
  expect(after).toContain('"entries":[]');
});

test('Export downloads the raw string verbatim and disarms the delete challenge', async ({ page }) => {
  const corrupt = '{"schema": 2, "drivers": [BROKEN';
  await seedRaw(page, corrupt);
  await openPicker(page);
  const modal = page.locator('.my-storage-modal');
  await expect(modal).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    modal.locator('.my-export-raw').evaluate((btn: HTMLElement) => btn.click())
  ]);
  const file = await download;
  expect(await (await file.createReadStream()).toArray().then(a => Buffer.concat(a).toString()))
    .toBe(corrupt);

  // exported this session: Delete acts on the FIRST press now
  await modal.locator('.my-delete-all').evaluate((btn: HTMLElement) => btn.click());
  await expect(modal).toBeHidden();
});

test('a broken entry is preserved, surfaced by name, and its Delete removes only it', async ({ page }) => {
  const broken = { brand: { value: 'Ghost' }, model: { value: 'Blob' }, halfARecord: true };
  await seedRaw(page, JSON.stringify({ schema: 1, entries: [broken, slot('u-ok', 'Good', 'One')] }));
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
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  await seedRaw(page, bucket(slot('u-edit', 'Orig', 'Name')));
  await openPicker(page);

  await page.locator('.my-ditem .my-edit').click();
  // .de-root has never existed in DriverEditorModal.vue — the editor's root class is .de-modal,
  // so this waited on nothing and the aria fallback matched the first driver-ish thing on the page.
  await expect(page.locator('.de-modal')).toBeVisible();
  // change the model, then Save through the save dialog
  const model = page.locator('input.save-model-input');
  await page.locator('.de-btns button', { hasText: /^OK$/ }).click();
  await expect(model).toBeVisible();
  await model.fill('Renamed');
  
  await page.locator('.save-confirm-btn').click();

  const question = page.locator('.de-rename-panel');
  await expect(question).toBeVisible();
  await expect(question).toContainText('brand or model');
  await question.locator('.save-as-copy-btn').click();

  const stored = await page.evaluate(k => localStorage.getItem(k as string), MY_DRIVERS_KEY);
  const parsed = JSON.parse(stored!) as { entries: { record: { model: { value: string } } }[] };
  expect(parsed.entries).toHaveLength(2);
  const models = parsed.entries.map(e => e.record.model.value).sort();
  expect(models).toEqual(['Name', 'Renamed']);
});

test('importing the same driver file twice through the real path yields two entries (S1)', async ({ page }) => {
  // The mint-fresh rule LIVES in driverBrowsingState.loadFromDisk — this exercises it
  // through the actual file input, not the repo given a correct caller.
  await seedRaw(page, bucket());
  await openPicker(page);

  const wdr = [
    '[Driver]', 'Brand=Twice', 'Model=Imported', 'Manufacturer=', 'ProvidedBy=', 'Comment=',
    'DateAdded=', 'DateModified=', 'Qts=0.4', 'Fs=40', 'Re=6', 'ParState=' + 'N'.repeat(49), '',
  ].join('\r\n');
  const file = { name: 'twice.wdr', mimeType: 'application/octet-stream', buffer: Buffer.from(wdr) };

  for (let i = 0; i < 2; i++) {
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('button', { hasText: /Load File/i }).first().click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(file);
    // Wait for the import to finish and the preview to appear
    await expect(page.locator('.cancel-btn')).toBeVisible();
    // Click Cancel to close the preview and return to the list
    await page.locator('.cancel-btn').click();
    await expect(page.locator('.my-ditem')).toHaveCount(i + 1);
  }

  const stored = await page.evaluate(k => localStorage.getItem(k as string), MY_DRIVERS_KEY);
  const parsed = JSON.parse(stored!) as { entries: { uuid: string }[] };
  expect(parsed.entries).toHaveLength(2);
  expect(parsed.entries[0]!.uuid).not.toBe(parsed.entries[1]!.uuid);
});
