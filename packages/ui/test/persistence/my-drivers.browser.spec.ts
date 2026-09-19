import type {Page} from '@playwright/test';
import {editorTab, expect, openAProject, test} from '../fixtures.js';
import {myDriversJson} from '../fixtures/seedMyDrivers.js';

// My Drivers is the ONE destination for every user-created driver. Four routes reach it and
// nothing else does: Add new Driver, Clone driver, Load File…, and saving a driver to a file
// then loading it back. Each is asserted against browser storage, which is where a saved
// driver actually lives — a row on screen proves rendering, not persistence.
//
// WinISD picker only (DriverBrowser.vue), per the agreed scope.

const SEEDED_BRAND = 'Spec';
const SEEDED_MODEL = 'Fixture';
const MY_DRIVERS_KEY = 'openisd_my_drivers';

const EDITOR = '.de-modal';
const POOL_ROWS = '.dlist .ditem:not(.my-ditem)';
const MY_ROWS = '.dlist .my-ditem';

interface SavedDriver { brand: string; model: string; specs: Record<string, number> }

/** One saved driver, so every test starts with a My Drivers section that exists. */
const SEEDED: SavedDriver = {
  brand: SEEDED_BRAND, model: SEEDED_MODEL,
  specs: {
    Fs_hz: 41, Qts: 0.35, Qes: 0.38, Qms: 4.5, Vas_m3: 0.028, Sd_m2: 0.0132,
    Re_ohm: 5.4, Le_H: 0.5e-3, Xmax_m: 0.0055, Pe_W: 70, Znom_ohm: 8,
  },
};

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
  await page.addInitScript(([json, key]) => {
    localStorage.setItem(key as string, json as string);
  }, [myDriversJson(myDrivers), MY_DRIVERS_KEY] as const);
  await page.goto('/');
  await openAProject(page);
}

async function openPicker(page: Page): Promise<void> {
  await page.locator('[title*="librar" i]').first().click();
  await expect(page.locator('.dlist')).toBeVisible();
}

/** The brand/model of every driver in My Drivers right now, read out of the stored envelope
 *  ({ schema, entries: [{ uuid, record }] }) the app writes. */
async function savedNames(page: Page): Promise<{ brand: string; model: string }[]> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key as string);
    if (!raw) return [];
    const env = JSON.parse(raw) as { entries?: { record?: { brand?: { value?: string }; model?: { value?: string } } }[] };
    return (env.entries ?? []).map(e => ({
      brand: e.record?.brand?.value ?? '',
      model: e.record?.model?.value ?? '',
    }));
  }, MY_DRIVERS_KEY);
}

async function savedIds(page: Page): Promise<string[]> {
  return (await savedNames(page)).map(d => `${d.brand}/${d.model}`).sort();
}

/** The project's own driver, read off the Original shell's read-only Brand/Model pair. */
async function projectDriver(page: Page): Promise<string> {
  const row = page.locator('.driver-id-row').first();
  return `${await row.locator('input').nth(0).inputValue()}/${await row.locator('input').nth(1).inputValue()}`;
}

/** A driver-editor field, addressed by the WinISD name its tooltip ends with. */
/**
 * An editor cell by its `data-field-key` — the stable, human-meaningful key every `.de-fld`
 * carries (`brand`, `model`, `Fs`, `Vas`, `Re`, `Sd`, …). The old locator matched the tail of
 * the hover `title`, which is help text and moved out from under it; a key is a contract.
 * The General identity keys are lower-case, the parameter keys are WinISD's own names.
 */
function field(page: Page, key: string) {
  return page.locator(`.de-fld[data-field-key="${key}"] input`);
}

const SEEDED_ID = `${SEEDED_BRAND}/${SEEDED_MODEL}`;

// ---- route 1: Add new Driver -----------------------------------------------------------

test('Add new Driver opens a completely blank driver; OK asks for an identity instead of dying', async ({ page }) => {
  await seed(page);
  await openPicker(page);
  await page.getByRole('button', { name: 'Add new Driver' }).click();

  await expect(page.locator(EDITOR)).toBeVisible();
  await expect(page.locator(EDITOR), 'a new driver is a MY driver, not the project\'s').toContainText('Edit My Driver');
  await editorTab(page, 'General');          // Brand and Model live here; the editor opens on Parameters
  await expect(field(page, 'brand'), 'the new driver was pre-seeded with a brand').toHaveValue('');
  await expect(field(page, 'model'), 'the new driver was pre-seeded with a model').toHaveValue('');
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

  await editorTab(page, 'General');          // Brand and Model live here
  await field(page, 'brand').fill('Bench');
  await field(page, 'model').fill('Hand Built');
  await page.locator(`${EDITOR} .de-tab`).filter({ hasText: /^Parameters$/ }).click();
  await field(page, 'Fs_hz').fill('42');
  await field(page, 'Vas_m3').fill('30');      // litres — the field's display scale
  await field(page, 'Re_ohm').fill('5.5');
  await field(page, 'Sd_m2').fill('130');      // cm² — the field's display scale
  await field(page, 'Sd_m2').blur();

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

  const saved = await savedNames(page);
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

  const saved = await savedNames(page);
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

test('a loaded driver comment stays in the General tab comment field', async ({ page }) => {
  await seed(page);
  await openPicker(page);
  const withComment = DISK_WDR.replace('ProvidedBy=OpenISD', 'ProvidedBy=OpenISD\nComment=imported-comment-123456');
  await page.locator('.wb-modal input[type=file]').setInputFiles({
    name: 'commented.wdr', mimeType: 'application/x-winisd-driver', buffer: Buffer.from(withComment),
  });

  await expect(page.locator('.wb-modal .preview')).toBeVisible();
  await expect(page.locator('.wb-modal .prev-notes')).toContainText('imported-comment-123456');
  await page.locator('.wb-modal .edit-btn').click();
  await expect(page.locator(EDITOR)).toBeVisible();
  await editorTab(page, 'General');          // .de-general only exists on the General pane
  await expect(page.locator('.de-general .de-comment')).toHaveCount(1);
  await expect(page.locator('.de-general .de-comment textarea')).toHaveValue('imported-comment-123456');
  await expect(page.locator(`${EDITOR} > .de-comment`)).toHaveCount(0);
});

test('a file that names no brand or model takes its identity from the file name', async ({ page }) => {
  await seed(page);
  await openPicker(page);
  await page.locator('.wb-modal input[type=file]').setInputFiles({
    name: 'my nameless driver.wdr', mimeType: 'application/x-winisd-driver', buffer: Buffer.from(NAMELESS_WDR),
  });

  await expect.poll(async () => (await savedNames(page)).length).toBe(2);
  const loaded = (await savedNames(page)).find(d => d.model !== SEEDED_MODEL);
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
  expect(await savedNames(page), 'the saved driver was not removed').toEqual([]);

  // 3. Load the file back — My Drivers, nowhere else.
  await page.locator('.wb-modal input[type=file]').setInputFiles({
    name: fileName, mimeType: 'application/x-winisd-driver', buffer: Buffer.from(written[fileName]),
  });
  await expect.poll(() => savedIds(page), { message: 'the round-tripped driver did not return to My Drivers' })
    .toEqual([SEEDED_ID]);
});

// ---- Edit enablement -------------------------------------------------------------------

test('Edit is enabled for library driver overview and saving goes to My Drivers with brand/model prompt', async ({ page }) => {
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

  // Fill with a new unique brand/model and confirm
  await page.locator('.save-brand-input').fill('Library');
  await page.locator('.save-model-input').fill('Edited Copy');

  // Save to My Drivers
  await page.locator('.save-confirm-btn').click();
  await expect(page.locator(EDITOR)).toBeHidden();

  // Verify the new entry was saved alongside the seeded one (coexistence, QO81: same-name
  // drivers coexist by uuid — no overwrite, no warning)
  expect(await savedIds(page)).toContain(SEEDED_ID);
  expect(await savedIds(page)).toContain('Library/Edited Copy');
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
