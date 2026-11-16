/**
 * The passive radiator's Select / Info / Edit, as the driver's (John, 16 Nov 2026: 11:05 UTC QO946.c115 "I want an editor for
 * the pr ... save to my prs ... ok and cancel, the numbers must disappear from the mobile box page but remain on the desktop";
 * 11:42 "we need the same select info edit setup and workflow as the driver"; 12:46 "looks ok" on the mock; 12:47 "on the Info
 * page show the Type: Passive Radiator").
 * The editor, both skins: tabs General (name) and Parameters (Vas, Qms, Fs, Sd, Mms, Cms, Rms, Xmax), Auto calculate unknowns,
 * Inspect Provenance, OK, Cancel, Reset, Export, Import, Copy to My PRs (desktop footer; phone More menu, as the driver editor).
 * The build choices (count, added mass, tuning) stay on the project's page (QO946.c38) and are not in the editor.
 * Define new passive radiator (in the Select popup): pr-define.browser.spec.ts.
 */
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import type {Locator, Page} from '@playwright/test';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

declare global {
  interface Window {
    __savedFiles?: Record<string, string>;
  }
}

const LOADED = 'ASP190';
const EDITOR = "Edit Project's Passive Radiator";
const FIGURES = ['vas', 'qms', 'fs', 'sd', 'mms', 'cms', 'rms', 'xmax'] as const;

/** The system save dialog cannot be driven from a test: `showSaveFilePicker` keeps the bytes in the page (as my-drivers.browser.spec.ts). */
async function captureSavedFiles(page: Page): Promise<void> {
  await page.evaluate(() => {
    const files: Record<string, string> = {};
    window.__savedFiles = files;
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: async (opts?: { suggestedName?: string }) => {
        const name = opts?.suggestedName ?? 'unnamed';
        return {
          name,
          createWritable: async () => ({
            write: async (t: string | Uint8Array | Blob) => { files[name] = typeof t === 'string' ? t : t instanceof Blob ? await t.text() : new TextDecoder().decode(t); },
            close: async () => { /* the text is already held */ },
          }),
        };
      },
    });
  });
}

/** The app's message: the desktop flash, the phone's status strip. */
const flash = (page: Page) => page.locator('.flash, [data-testid=flash-strip]');

function suite(skin: 'desktop' | 'phone') {
  const select = (page: Page) => skin === 'desktop'
    ? page.locator('.edit-btn[title^="Browse bundled"]')
    : page.getByRole('button', {name: 'Select PR'});
  const openEditor = async (page: Page): Promise<Locator> => {
    await page.locator(skin === 'desktop' ? '#og-pr-edit' : '#mob-pr-edit').click();
    const editor = page.getByRole('dialog', {name: EDITOR});
    await expect(editor).toBeVisible();
    return editor;
  };
  /** A footer action: in the desktop footer, behind More on the phone (as the driver editor). */
  const action = async (editor: Locator, name: string) => {
    if (skin === 'phone') {
      await editor.getByRole('button', {name: /More/}).click();
      await editor.getByRole('menuitem', {name}).click();
    } else {
      await editor.getByRole('button', {name, exact: true}).click();
    }
  };
  /** Export, Import, Copy to My PRs and Reset: the desktop footer's buttons, the phone's More menu (as the driver editor). */
  const expectFileActions = async (editor: Locator) => {
    const names = ['Export', 'Import', 'Copy to My PRs', 'Reset'];
    if (skin === 'desktop') {
      for (const b of names) await expect(editor.getByRole('button', {name: b, exact: true})).toBeVisible();
      return;
    }
    await editor.getByRole('button', {name: /More/}).click();
    for (const m of names) await expect(editor.getByRole('menuitem', {name: m})).toBeVisible();
    await editor.getByRole('button', {name: /More/}).click();
  };
  /** The desktop page shows the radiator's Vas; the phone shows it only in the editor. */
  const expectPageVas = async (page: Page, value: RegExp) => {
    if (skin === 'desktop') await expect(page.locator('#og-pr-vas')).toHaveValue(value);
  };
  const tab = (editor: Locator, name: 'General' | 'Parameters') => editor.getByRole('tab', {name}).click();
  /** The project's radiator name, as its page shows it. */
  const expectProjectName = async (page: Page, text: RegExp | string) => {
    if (skin === 'desktop') await expect(page.locator('#og-pr-name')).toHaveValue(text);
    else await expect(page.locator('#mob-pr-name-btn')).toContainText(text);
  };

  test.beforeEach(async ({appPage: page}) => {
    if (skin === 'phone') {
      await page.setViewportSize({width: 390, height: 844});
      await forceMobileSkin(page);
      await page.goto('/');
      await openAMobileProject(page);
      await page.locator('.mob-tab', {hasText: 'Box'}).click();
      await page.locator('#mob-box-type').selectOption('box-passive-radiator');
    } else {
      await page.goto('/');
      await openAProject(page);
      await page.locator('select#og-box-type').selectOption('box-passive-radiator');
      await page.locator('.project-nav li', {hasText: 'Passive Radiator'}).click();
    }
    await select(page).click();
    await page.locator('.pr-lib-item .pr-lib-name', {hasText: LOADED}).first().click();
    await expect(page.locator('.pr-filter')).toHaveCount(0);
    await expectProjectName(page, new RegExp(LOADED));
  });

  test('the editor holds every radiator figure and the name, the driver editor\'s buttons, and no build choice', async ({appPage: page}) => {
    const editor = await openEditor(page);
    await expect(editor.getByRole('tab', {name: 'Parameters'})).toHaveAttribute('aria-selected', 'true');
    for (const f of FIGURES) await expect(editor.locator(`#pr-editor-${f}`)).toBeVisible();
    await expect(editor.locator('#pr-editor-fs')).not.toHaveValue('');
    await expect(editor.getByText(/Number of|Added mass|Fp\b/)).toHaveCount(0);
    await expect(editor.getByRole('checkbox', {name: 'Auto calculate unknowns'})).toBeChecked();
    await expect(editor.getByRole('checkbox', {name: 'Inspect Provenance'})).not.toBeChecked();
    for (const b of ['OK', 'Cancel']) await expect(editor.getByRole('button', {name: b, exact: true})).toBeVisible();
    await expectFileActions(editor);
    // General: the fields the radiator record carries, as the driver editor's General tab (John, 16 Nov 2026 14:03).
    await tab(editor, 'General');
    await expect(editor.locator('#pr-editor-name')).toHaveValue(new RegExp(LOADED));
    await expect(editor.locator('#pr-editor-brand')).toHaveValue('Accuton');
    await expect(editor.locator('#pr-editor-manufacturer')).toHaveValue('Accuton');
    for (const id of ['provided-by', 'added', 'comment']) await expect(editor.locator(`#pr-editor-${id}`)).toBeVisible();
    await editor.getByRole('button', {name: 'Cancel', exact: true}).click();
  });

  test('OK applies the edits to the project\'s radiator', async ({appPage: page}) => {
    let editor = await openEditor(page);
    await editor.locator('#pr-editor-xmax').fill('17');
    await editor.locator('#pr-editor-xmax').press('Tab');
    await editor.locator('#pr-editor-vas').fill('61');
    await editor.locator('#pr-editor-vas').press('Tab');
    await tab(editor, 'General');
    await editor.locator('#pr-editor-name').fill('Edited radiator');
    await editor.getByRole('button', {name: 'OK', exact: true}).click();
    await expect(editor).toHaveCount(0);
    await expectProjectName(page, 'Edited radiator');
    await expectPageVas(page, /^61/);
    editor = await openEditor(page);
    await expect(editor.locator('#pr-editor-xmax')).toHaveValue(/^17/);
    await editor.getByRole('button', {name: 'Cancel', exact: true}).click();
  });

  test('Cancel discards the edits, and Reset puts back what the editor opened with', async ({appPage: page}) => {
    let editor = await openEditor(page);
    const before = await editor.locator('#pr-editor-xmax').inputValue();
    await editor.locator('#pr-editor-xmax').fill('42');
    await editor.locator('#pr-editor-xmax').press('Tab');
    await expect(editor.locator('#pr-editor-xmax')).toHaveValue(/^42/);
    await action(editor, 'Reset');
    await expect(editor.locator('#pr-editor-xmax')).toHaveValue(before);
    await editor.locator('#pr-editor-xmax').fill('43');
    await editor.locator('#pr-editor-xmax').press('Tab');
    await editor.getByRole('button', {name: 'Cancel', exact: true}).click();
    await expect(editor).toHaveCount(0);
    editor = await openEditor(page);
    await expect(editor.locator('#pr-editor-xmax')).toHaveValue(before);
    await editor.getByRole('button', {name: 'Cancel', exact: true}).click();
  });

  test('Copy to My PRs files the radiator in My passive radiators and says so; the project changes only on OK', async ({appPage: page}) => {
    const editor = await openEditor(page);
    await tab(editor, 'General');
    await editor.locator('#pr-editor-name').fill(`Kept in my PRs ${skin}`);
    await action(editor, 'Copy to My PRs');
    await expect(editor.getByRole('status')).toContainText(`Kept in my PRs ${skin}`);
    await editor.getByRole('button', {name: 'Cancel', exact: true}).click();
    await expectProjectName(page, new RegExp(LOADED));
    await select(page).click();
    await expect(page.locator('.pr-lib-item', {hasText: `Kept in my PRs ${skin}`})).toBeVisible();
    await page.getByRole('button', {name: 'Done'}).click();
  });

  test('Export writes the radiator to a file, and Import reads it back into the editor', async ({appPage: page}) => {
    await captureSavedFiles(page);
    const editor = await openEditor(page);
    await action(editor, 'Export');
    await expect(flash(page)).toContainText(/Passive radiator exported as .*ASP190.*\.owdr/);
    const written = await page.evaluate(() => window.__savedFiles ?? {});
    const fileName = Object.keys(written)[0] ?? '';
    expect(fileName).toMatch(/ASP190.*\.owdr$/);
    await editor.locator('#pr-editor-xmax').fill('31');
    await editor.locator('#pr-editor-xmax').press('Tab');
    expect(written[fileName], 'the file holds the radiator record').toContain('Xmax_m');
    const chooser = page.waitForEvent('filechooser');
    await action(editor, 'Import');
    await (await chooser).setFiles({name: fileName, mimeType: 'application/x-openisd-driver', buffer: Buffer.from(written[fileName] ?? '')});
    await expect(flash(page)).toContainText(`Passive radiator imported from ${fileName}`);
    await expect(editor.locator('#pr-editor-xmax')).not.toHaveValue(/^31/);
    await editor.getByRole('button', {name: 'Cancel', exact: true}).click();
  });

  test('Auto calculate unknowns: ticked, a typed figure recalculates the others; unticked, it does not', async ({appPage: page}) => {
    const editor = await openEditor(page);
    const mms = editor.locator('#pr-editor-mms');
    const cmsBefore = await editor.locator('#pr-editor-cms').inputValue();
    await editor.getByRole('checkbox', {name: 'Auto calculate unknowns'}).uncheck();
    await editor.locator('#pr-editor-vas').fill('54');
    await editor.locator('#pr-editor-vas').press('Tab');
    await expect(editor.locator('#pr-editor-cms')).toHaveValue(cmsBefore);
    await editor.getByRole('checkbox', {name: 'Auto calculate unknowns'}).check();
    await expect(editor.locator('#pr-editor-cms')).not.toHaveValue(cmsBefore);
    await expect(mms).not.toHaveValue('');
    await editor.getByRole('button', {name: 'Cancel', exact: true}).click();
  });

  test('Inspect Provenance says how a figure is worked out', async ({appPage: page}) => {
    const editor = await openEditor(page);
    await editor.getByRole('checkbox', {name: 'Inspect Provenance'}).check();
    await editor.locator('#pr-editor-cms').click();
    const card = editor.getByRole('region', {name: 'Provenance'});
    await expect(card).toContainText('Cms');
    await expect(card).toContainText(/Calculated|Entered/);
    await expect(card).toContainText('Vas');
    await editor.getByRole('checkbox', {name: 'Inspect Provenance'}).uncheck();
    await expect(card).toHaveCount(0);
    await editor.getByRole('button', {name: 'Cancel', exact: true}).click();
  });

  test('Info shows the radiator, affirmed as a passive radiator, read only', async ({appPage: page}) => {
    await page.locator(skin === 'desktop' ? '#og-pr-info' : '#mob-pr-info').click();
    const info = page.getByRole('dialog', {name: new RegExp(LOADED)});
    await expect(info).toBeVisible();
    await expect(info.locator('.pri-type')).toHaveText(/Type\s*Passive Radiator/);
    await expect(info).toContainText('Vas');
    await expect(info).toContainText('Xmax');
    await expect(info.locator('input')).toHaveCount(0);
    await info.locator('.pri-close').click();
    await expect(info).toHaveCount(0);
  });
}

test.describe('desktop', () => {
  suite('desktop');

  test('the Passive Radiator page keeps its figures, WinISD-like, with Select, Info and Edit as the Driver page', async ({appPage: page}) => {
    await page.goto('/');
    await openAProject(page);
    await page.locator('select#og-box-type').selectOption('box-passive-radiator');
    await page.locator('.project-nav li', {hasText: 'Passive Radiator'}).click();
    for (const id of ['#og-pr-vas', '#og-pr-qms', '#og-pr-fs', '#og-pr-mms', '#og-pr-cms', '#og-pr-rms', '#og-pr-count', '#og-pr-madd', '#og-pr-info', '#og-pr-edit']) {
      await expect(page.locator(id)).toBeVisible();
    }
  });
});

test.describe('phone', () => {
  suite('phone');

  test('the Box tab shows the radiator by name with Select PR, Info and Edit, without its figures; the build choices stay', async ({appPage: page}) => {
    const box = page.locator('.mob-csection', {has: page.locator('#mob-pr-edit')});
    await expect(page.locator('#mob-pr-name-btn')).toContainText(LOADED);
    for (const label of [/^Vas/, /^Qms/, /^Sd/, /^Mms/, /^Cms/, /^Rms/, /^Xmax/]) {
      await expect(box.locator('label', {hasText: label})).toHaveCount(0);
    }
    await expect(page.locator('#mob-pr-info')).toBeVisible();
    await expect(page.locator('#mob-pr-count')).toBeVisible();
    await page.locator('#mob-pr-name-btn').click();
    await expect(page.locator('.pr-filter')).toBeVisible();
    await page.getByRole('button', {name: 'Done'}).click();
  });

  // John, 16 Nov 2026 12:57 / 12:58: Key figures beside User options, as the Driver tab: Fpr, Mms, Sd, Xmax and the displacement Vd.
  test('the Box tab shows Key figures: Fpr, Mms, Sd, Xmax and Vd; tapping one opens the editor', async ({appPage: page}) => {
    for (const id of ['fs', 'mms', 'sd', 'xmax', 'vd']) await expect(page.locator(`#mob-pr-key-${id}`)).not.toHaveValue('');
    await expect(page.locator('#mob-pr-key-xmax')).toHaveValue('12.00');
    await expect(page.locator('#mob-pr-key-sd')).toHaveValue('202.00');
    await expect(page.locator('#mob-pr-key-vd')).toHaveValue(/^242/);   // 202 cm² × 12 mm = 242.4 cm³
    // Hand-worked (plan): driver Tang Band W5-1138SMF Vd 86.95 cm³, one driver → radiators need ≥ 173.9 cm³; ASP190 Vd 242.4 cm³ → one is enough.
    await expect(page.locator('#mob-pr-two-times')).toHaveText('2× rule: radiators need ≥ 174 cm³ — 1 of these is enough');
    // Three drivers need ≥ 3 × 2 × 86.95 = 521.7 cm³: 521.7 / 242.4 = 2.15, so three of these.
    await page.locator('.mob-tab', {hasText: 'Driver'}).click();
    await page.locator('#mob-n-drivers').selectOption('3');
    await page.locator('.mob-tab', {hasText: 'Box'}).click();
    await expect(page.locator('#mob-pr-two-times')).toHaveText('2× rule: radiators need ≥ 522 cm³ — needs 3 of these');
    await page.locator('#mob-pr-key-mms').click();
    await expect(page.getByRole('dialog', {name: EDITOR})).toBeVisible();
    await page.getByRole('dialog', {name: EDITOR}).getByRole('button', {name: 'Cancel', exact: true}).click();
  });

  // John, 16 Nov 2026 12:47: "the labels on sections aren't consistent "driver" in the driver page and "user options" on the pr page, make both User options".
  test('the Driver tab\'s choices are headed User options, as the passive radiator\'s', async ({appPage: page}) => {
    await page.locator('.mob-tab', {hasText: 'Driver'}).click();
    const bands = page.locator('.mob-band-title');
    await expect(bands.filter({hasText: /^User options$/i})).toHaveCount(1);
    await expect(bands.filter({hasText: /^Driver$/i})).toHaveCount(0);
  });
});
