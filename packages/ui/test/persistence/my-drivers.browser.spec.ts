import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures.js';

// My Drivers is the ONE destination for every user-created driver. Four routes reach it and
// nothing else does: Add new Driver, Clone driver, Load File…, and saving a driver to a file
// then loading it back. Each is asserted against browser storage, which is where a saved
// driver actually lives — a row on screen proves rendering, not persistence.
//
// WinISD picker only (DriverBrowserWinisd.vue), per the agreed scope. The skin is seeded
// through localStorage because store.ts forces `modern` on port 4100, this suite's port.

const SEEDED_BRAND = 'Spec';
const SEEDED_MODEL = 'Fixture';
const MY_DRIVERS_KEY = 'openisd_my_drivers';

const EDITOR = '.de-modal';
const POOL_ROWS = '.dlist .ditem:not(.my-ditem)';
const MY_ROWS = '.dlist .my-ditem';

interface SavedDriver { brand?: string; model?: string; Fs?: number }

/** One saved driver, so every test starts with a My Drivers section that exists. */
const SEEDED: SavedDriver = {
  brand: SEEDED_BRAND, model: SEEDED_MODEL,
  Fs: 41, Qts: 0.35, Qes: 0.38, Qms: 4.5, Vas: 0.028, Sd: 0.0132,
  Re: 5.4, Le: 0.5e-3, Xmax: 0.0055, Pe: 70, Znom: 8,
} as SavedDriver;

/** A minimal WinISD driver file, as a user's own `.wdr` on disk would read. */
const DISK_WDR = [
  '[Driver]',
  'Brand=Bench',
  'Model=From Disk',
  'Manufacturer=',
  'ProvidedBy=OpenISD',
  'Fs=38',
  'Qts=0.4',
  'Qes=0.44',
  'Qms=5',
  'Vas=0.032',
  'Sd=0.0135',
  'Re=5.6',
  'Le=0.0007',
  'Xmax=0.006',
  'Pe=90',
  'Znom=8',
  '',
].join('\n');

/** A `.wdr` carrying no Brand and no Model — its identity has to come from the file NAME. */
const NAMELESS_WDR = DISK_WDR.replace('Brand=Bench', 'Brand=').replace('Model=From Disk', 'Model=');

/**
 * The system save dialog cannot be driven from a test, so `showSaveFilePicker` is replaced
 * with a handle that keeps the bytes in the page. Everything upstream of it is the real
 * thing — the driver, `toWdr()`, the format picker — so a round trip through this stub is a
 * round trip through the app's own writer.
 */
async function captureSavedFiles(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const files: Record<string, string> = {};
    (window as unknown as { __savedFiles: Record<string, string> }).__savedFiles = files;
    (window as unknown as { showSaveFilePicker: unknown }).showSaveFilePicker =
      async (opts?: { suggestedName?: string }) => {
        const name = opts?.suggestedName ?? 'unnamed';
        return {
          createWritable: async () => ({
            write: async (t: string) => { files[name] = t; },
            close: async () => { /* nothing to flush — the text is already held */ },
          }),
        };
      };
  });
}

async function seed(page: Page, myDrivers: SavedDriver[] = [SEEDED]): Promise<void> {
  await page.addInitScript(([drivers, key]) => {
    localStorage.setItem('openisd.state', JSON.stringify({ ui: { skin: 'original' } }));
    localStorage.setItem(key as string, JSON.stringify(drivers));
  }, [myDrivers, MY_DRIVERS_KEY] as const);
  await page.goto('/');
}

async function openPicker(page: Page): Promise<void> {
  await page.locator('[title*="librar" i]').first().click();
  await expect(page.locator('.dlist')).toBeVisible();
}

/** What is in My Drivers right now. */
async function savedDrivers(page: Page): Promise<SavedDriver[]> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key as string) ?? '[]'), MY_DRIVERS_KEY);
}

async function savedIds(page: Page): Promise<string[]> {
  return (await savedDrivers(page)).map(d => `${d.brand}/${d.model}`).sort();
}

/** The project's own driver, read off the Original shell's read-only Brand/Model pair. */
async function projectDriver(page: Page): Promise<string> {
  const row = page.locator('.driver-id-row').first();
  return `${await row.locator('input').nth(0).inputValue()}/${await row.locator('input').nth(1).inputValue()}`;
}

/** A driver-editor field, addressed by the WinISD name its tooltip ends with. */
function field(page: Page, winisdName: string) {
  return page.locator(`.de-fld[title$="WinISD: ${winisdName}"] input`);
}

const SEEDED_ID = `${SEEDED_BRAND}/${SEEDED_MODEL}`;

// ---- route 1: Add new Driver -----------------------------------------------------------

test('Add new Driver opens a completely blank driver; OK asks for an identity instead of dying', async ({ page }) => {
  await seed(page);
  await openPicker(page);
  await page.getByRole('button', { name: 'Add new Driver' }).click();

  await expect(page.locator(EDITOR)).toBeVisible();
  await expect(page.locator(EDITOR), 'a new driver is a MY driver, not the project\'s').toContainText('Edit My Driver');
  await expect(field(page, 'Brand'), 'the new driver was pre-seeded with a brand').toHaveValue('');
  await expect(field(page, 'Model'), 'the new driver was pre-seeded with a model').toHaveValue('');
  // Human ruling 2026-08-05: every button works regardless of the driver's state. Brand +
  // Model is the index key, so OK still declines to FILE a driver without one — but it says
  // so and puts the caret in the field, instead of going dead and explaining nothing.
  const ok = page.locator(`${EDITOR} .de-footer button:has-text("OK")`);
  await expect(ok, 'a dead button explains nothing — OK must answer the click').toBeEnabled();
  await ok.click();
  await expect(page.getByText('Brand and Model are both required')).toBeVisible();
  await expect(page.locator(EDITOR), 'nothing was filed under a missing identity').toBeVisible();
});

test('Add new Driver saves the new driver into My Drivers and leaves the project alone', async ({ page }) => {
  await seed(page);
  const before = await projectDriver(page);
  await openPicker(page);
  await page.getByRole('button', { name: 'Add new Driver' }).click();

  await field(page, 'Brand').fill('Bench');
  await field(page, 'Model').fill('Hand Built');
  await page.locator(`${EDITOR} .de-tab`).filter({ hasText: /^Parameters$/ }).click();
  await field(page, 'Fs').fill('42');
  await field(page, 'Vas').fill('30');      // litres — the field's display scale
  await field(page, 'Re').fill('5.5');
  await field(page, 'Sd').fill('130');      // cm² — the field's display scale
  await field(page, 'Sd').blur();

  const ok = page.locator(`${EDITOR} .de-footer button:has-text("OK")`);
  await expect(ok, 'OK stayed disabled with brand, model and every required parameter filled').toBeEnabled();
  await ok.click();
  await page.locator('.save-confirm-btn').click();
  await expect(page.locator(EDITOR)).toBeHidden();

  expect(await savedIds(page)).toEqual([SEEDED_ID, 'Bench/Hand Built'].sort());
  expect(await projectDriver(page), 'creating a driver changed the project').toBe(before);
});

// ---- route 2: Clone driver -------------------------------------------------------------

test('Clone driver forks a saved driver into My Drivers as "Copy of …"', async ({ page }) => {
  await seed(page);
  await openPicker(page);
  await page.locator(MY_ROWS, { hasText: SEEDED_MODEL }).click();
  await page.locator('.wb-modal .clone-btn').click();

  const saved = await savedDrivers(page);
  expect(saved.map(d => d.model).sort()).toEqual(['Copy of Fixture', 'Fixture']);
  expect(saved.find(d => d.model === 'Copy of Fixture')?.brand,
    'the clone changed the brand — only the model forks').toBe(SEEDED_BRAND);
  // Clone lands on the CLONE's summary, so Edit is immediately available on it.
  await expect(page.locator('.wb-modal h2')).toContainText('Copy of Fixture');
  await expect(page.locator('.wb-modal .edit-btn'), 'the clone is a My Driver, so Edit must be live').toBeEnabled();
  await page.locator('.wb-modal .cancel-btn').click();
  await expect(page.locator(MY_ROWS), 'the clone did not appear in the My Drivers section').toHaveCount(2);
});

test('Clone driver copies a LIBRARY driver into My Drivers too', async ({ page }) => {
  await seed(page);
  await openPicker(page);
  const row = page.locator(POOL_ROWS).first();
  await expect(row, 'no library rows rendered — this spec would prove nothing').toBeVisible();
  await row.click();
  await page.locator('.wb-modal .clone-btn').click();

  const saved = await savedDrivers(page);
  expect(saved, 'the library clone did not reach My Drivers').toHaveLength(2);
  expect(saved.filter(d => d.model?.startsWith('Copy of '))).toHaveLength(1);
});

// ---- route 3: Load File… ---------------------------------------------------------------

test('Load File… puts the driver in My Drivers, not in the project', async ({ page }) => {
  await seed(page);
  const before = await projectDriver(page);
  await openPicker(page);
  await page.locator('.wb-modal input[type=file]').setInputFiles({
    name: 'bench.wdr', mimeType: 'application/x-winisd-driver', buffer: Buffer.from(DISK_WDR),
  });

  await expect.poll(() => savedIds(page), { message: 'the loaded file never reached My Drivers' })
    .toEqual([SEEDED_ID, 'Bench/From Disk'].sort());
  expect(await projectDriver(page), 'loading a file changed the project driver').toBe(before);

  // The picker lands on the new driver's summary, so "Use" is one click away.
  await expect(page.locator('.wb-modal .preview')).toBeVisible();
  await expect(page.locator('.wb-modal h2')).toContainText('From Disk');
});

test('a file that names no brand or model takes its identity from the file name', async ({ page }) => {
  await seed(page);
  await openPicker(page);
  await page.locator('.wb-modal input[type=file]').setInputFiles({
    name: 'my nameless driver.wdr', mimeType: 'application/x-winisd-driver', buffer: Buffer.from(NAMELESS_WDR),
  });

  await expect.poll(async () => (await savedDrivers(page)).length).toBe(2);
  const loaded = (await savedDrivers(page)).find(d => d.model !== SEEDED_MODEL);
  expect(loaded?.model, 'an unidentifiable driver was saved with no identity').toBe('my nameless driver');
});

// ---- route 4: save a .wdr and load it back ---------------------------------------------

test('a driver saved to .wdr and loaded back lands in My Drivers', async ({ page }) => {
  await captureSavedFiles(page);
  await seed(page);
  await openPicker(page);

  // 1. Write the file with the app's own writer.
  await page.locator(MY_ROWS, { hasText: SEEDED_MODEL }).locator('.my-edit').click();
  await expect(page.locator(EDITOR)).toBeVisible();
  await page.locator(`${EDITOR} .de-footer button:has-text("Save")`).click();
  await page.locator('.fmt-opt').filter({ hasText: '.wdr' }).click();
  const written = await page.evaluate(() =>
    (window as unknown as { __savedFiles: Record<string, string> }).__savedFiles);
  const fileName = Object.keys(written)[0];
  expect(fileName, 'the driver editor wrote no file').toBe('Spec Fixture.wdr');
  await page.locator(`${EDITOR} .de-footer button:has-text("Cancel")`).click();

  // 2. Remove it, so its reappearance can only come from the file.
  await page.locator(MY_ROWS, { hasText: SEEDED_MODEL }).locator('.my-del').click();
  expect(await savedDrivers(page), 'the saved driver was not removed').toEqual([]);

  // 3. Load the file back — My Drivers, nowhere else.
  await page.locator('.wb-modal input[type=file]').setInputFiles({
    name: fileName, mimeType: 'application/x-winisd-driver', buffer: Buffer.from(written[fileName]),
  });
  await expect.poll(() => savedIds(page), { message: 'the round-tripped driver did not return to My Drivers' })
    .toEqual([SEEDED_ID]);
});

// ---- Edit enablement -------------------------------------------------------------------

test('Edit is enabled for library driver overview and saving goes to My Drivers with brand/model prompt and overwrite warning', async ({ page }) => {
  await seed(page);
  await openPicker(page);

  // Click a library driver row
  await page.locator(POOL_ROWS).first().click();
  const libEdit = page.locator('.wb-modal .edit-btn');
  await expect(libEdit, 'Edit button must be enabled for library drivers in overview').toBeEnabled();

  await libEdit.click();
  await expect(page.locator(EDITOR)).toBeVisible();

  // Click OK to save to My Drivers
  await page.locator(`${EDITOR} .de-footer button:has-text("OK")`).click();

  // Save to My Drivers prompt dialog should appear with pre-filled Brand/Model
  const savePanel = page.locator('.de-save-my-panel');
  await expect(savePanel).toBeVisible();

  // Pre-fill with existing seeded driver brand/model to trigger overwrite warning
  await page.locator('.save-brand-input').fill(SEEDED_BRAND);
  await page.locator('.save-model-input').fill(SEEDED_MODEL);

  await expect(page.locator('.save-warn'), 'Warning should appear when saving a driver with an existing brand/model').toBeVisible();

  // Save to My Drivers
  await page.locator('.save-confirm-btn').click();
  await expect(page.locator(EDITOR)).toBeHidden();

  // Verify saved in My Drivers
  expect(await savedIds(page)).toContain(SEEDED_ID);
});

// ---- favourites reach My Drivers -------------------------------------------------------

test('a My Drivers row stars like any other, and the Favorites filter covers that section', async ({ page }) => {
  await seed(page);
  await openPicker(page);

  const star = page.locator(MY_ROWS, { hasText: SEEDED_MODEL }).locator('.fav-btn');
  await expect(star, 'a My Drivers row carries no star toggle').toHaveCount(1);
  await star.click();
  await expect(star, 'starring a My Driver did not mark it').toHaveClass(/on/);

  await page.locator('.fav-filter').click();
  await expect(page.locator(MY_ROWS), 'the Favorites filter dropped the starred My Driver').toHaveCount(1);
  await expect(page.locator(POOL_ROWS), 'the Favorites filter left unstarred library rows on screen').toHaveCount(0);
});
