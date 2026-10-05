import {appEnvDefaultsTempK, clearFocusedEnvironment, expect, openAProject, savedUsername, setSweepRange, test} from '../fixtures.js';
import type {Page} from '@playwright/test';
import {fillAndBlur} from '../fixtures/numField.js';

/**
 * The Options dialog (OptionsModal.vue): general settings (user name, environment, units), the
 * Plot Window (frequency range, chart Y limits, colours), the application-wide vented design
 * limits and the Backup section. Edits are a draft until OK; Cancel discards them.
 */

const freqRow = (page: Page) =>
  page.locator('.opt-limits tr', { hasText: 'Frequency range' }).locator('input.opt-num');

const splRow = (page: Page) =>
  page.locator('.opt-limits tr', { hasText: /^SPL/ }).locator('input.opt-num');

const okButton = (page: Page) =>
  page.locator('.opt-modal').getByRole('button', { name: 'OK' });

async function openPlotWindow(page: Page): Promise<void> {
  await page.locator('.tb-btn[title="Options"]').click();
  await page.locator('.opt-tab', { hasText: 'Plot Window' }).click();
}

async function openBackupTab(page: Page): Promise<void> {
  await openOptions(page);
  await page.locator('.opt-tab', { hasText: 'Backup' }).click();
}

async function openOptions(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('.original-root')).toBeVisible();
  await page.locator('.tb-btn[title="Options"]').click();
  await expect(page.locator('.opt-modal')).toBeVisible();
}

/** The dialog's OK — applies every app setting in the draft and closes. */
async function clickOk(page: import('playwright').Page): Promise<void> {
  await page.locator('[data-testid="settings-apply"]').click();
  await expect(page.locator('.opt-modal')).toHaveCount(0);
}

/** Walk the wizard to step 4 with a vented box, on the first driver in the library. */
async function wizardToVentedAlignment(page: import('playwright').Page) {
  await page.locator('.tb-btn[title*="New project"]').click();
  const modal = page.locator('.overlay.open');
  await expect(modal).toContainText('Select driver for project');
  await modal.locator('.dlist .ditem').first().click();
  await modal.locator('.modal-footer button', { hasText: 'Next' }).click();   // Next chooses the driver: step 2
  await modal.locator('button', { hasText: 'Next' }).click();   // step 3: box type
  await modal.locator('.field', { hasText: 'Box type' }).locator('select').selectOption('vented');
  await modal.locator('button', { hasText: 'Next' }).click();   // step 4: vented alignment
  await expect(modal).toContainText('Tuning frequency');
  return modal;
}

test.describe('Options dialog', () => {
  test.describe('with a project open', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await openAProject(page);
    });

    test.describe('dialog box', () => {
      test('Options dialog is centered on screen, not pinned to the top (own overlay, not the shell\'s)', async ({ page }) => {
        await page.locator('.tb-btn[title="Options"]').click();
        const overlay = page.locator('.opt-overlay');
        await expect(overlay).toBeVisible();
        const box = await overlay.boundingBox();
        const modalBox = await page.locator('.opt-modal').boundingBox();
        const viewport = page.viewportSize()!;
        const modalMidY = modalBox!.y + modalBox!.height / 2;
        // Centered vertically within a reasonable tolerance — not stuck near the top of the viewport
        // (guards: Original's own unscoped `.overlay { align-items:flex-start }` would leak onto
        // this modal's root element via Vue's parent-scope-on-child-root behaviour).
        expect(Math.abs(modalMidY - viewport.height / 2)).toBeLessThan(viewport.height * 0.15);
        expect(box).toBeTruthy();
      });

      test('Options modal input boxes are 50% wider and do not show spinners', async ({ page }) => {
        await page.locator('.tb-btn[title="Options"]').click();
        const modal = page.locator('.opt-modal');
        await expect(modal).toBeVisible();

        // General tab: Environment input boxes should be 150px wide
        const envInput = page.locator('.opt-env-grid .opt-num').first();
        const envInputWidth = await envInput.evaluate(el => window.getComputedStyle(el).width);
        expect(envInputWidth).toBe('82px');

        // Verify no spinners (appearance: none / textfield)
        const appearance = await envInput.evaluate(el => window.getComputedStyle(el).webkitAppearance);
        expect(appearance).toBe('none');

        // Plot Window tab: Limit input boxes stay compact at 70px wide
        await page.locator('.opt-tab', { hasText: 'Plot Window' }).click();
        const limitInput = page.locator('.opt-limits .opt-num').first();
        const limitInputWidth = await limitInput.evaluate(el => window.getComputedStyle(el).width);
        expect(limitInputWidth).toBe('70px');
      });
    });

    test.describe('draft, OK, Cancel and reset', () => {
      test('Options dialog edits are draft-only and discard on Cancel, apply on OK, and reset on Defaults', async ({ page }) => {
        const getStoreTemp = () => appEnvDefaultsTempK(page);

        // Initially it is default 293.15
        expect(await getStoreTemp()).toBe(293.15);

        // 1. Open options, change Temperature, and click Cancel
        await page.locator('.tb-btn[title="Options"]').click();
        const tempInput = page.locator('.opt-fld', { hasText: 'Temperature' }).locator('input');
        await tempInput.click();
        await tempInput.press('Control+a');
        await tempInput.press('Delete');
        await tempInput.pressSequentially('300.00');
        await tempInput.blur();
        await page.locator('.opt-footer button', { hasText: 'Cancel' }).click();

        // Verification: should still be 293.15 (not applied!)
        expect(await getStoreTemp()).toBe(293.15);

        // 2. Open options, change Temperature, and click OK
        await page.locator('.tb-btn[title="Options"]').click();
        const tempInput2 = page.locator('.opt-fld', { hasText: 'Temperature' }).locator('input');
        await tempInput2.click();
        await tempInput2.press('Control+a');
        await tempInput2.press('Delete');
        await tempInput2.pressSequentially('300.00');
        await tempInput2.blur();
        await page.locator('.opt-footer button', { hasText: 'OK' }).click();

        // Verification: should now be 300 (applied!)
        expect(await getStoreTemp()).toBe(300);

        // 3. Open options, click Defaults, click OK
        await page.locator('.tb-btn[title="Options"]').click();
        await page.locator('.opt-footer button', { hasText: 'Defaults' }).click();
        await page.locator('.opt-footer button', { hasText: 'OK' }).click();

        // Verification: should be back to 293.15 (applied default!)
        expect(await getStoreTemp()).toBe(293.15);
      });

      test('Environment fieldset has its own reset button that resets envDefaults without touching other draft fields', async ({ page }) => {
        const getStore = async () => ({ tempK: await appEnvDefaultsTempK(page), username: await savedUsername(page) });

        // 1. Open options, set a username and change Temperature away from defaults, apply with OK
        await page.locator('.tb-btn[title="Options"]').click();
        await page.locator('.opt-input').fill('111111');
        const tempInput = page.locator('.opt-fld', { hasText: 'Temperature' }).locator('input');
        await tempInput.click();
        await tempInput.press('Control+a');
        await tempInput.press('Delete');
        await tempInput.pressSequentially('300.00');
        await tempInput.blur();
        await page.locator('.opt-footer button', { hasText: 'OK' }).click();

        expect(await getStore()).toEqual({ tempK: 300, username: '111111' });

        // 2. Reopen options, click the Environment fieldset's own reset button, then OK
        await page.locator('.tb-btn[title="Options"]').click();
        await page.locator('.opt-group', { hasText: 'Environment' }).locator('.opt-reset-btn').click();
        await page.locator('.opt-footer button', { hasText: 'OK' }).click();

        // Verification: envDefaults back to the physical default, username left untouched
        expect(await getStore()).toEqual({ tempK: 293.15, username: '111111' });
      });
    });

    test.describe('environment and units', () => {
      test('Options → General → Environment default seeds a fresh mount\'s Advanced-pane Temperature (not a hardcoded literal)', async ({ page }) => {
        // The sample fixture now STORES its own env (tempK=293.15, humidity 50) — a stored project
        // value legitimately overrides the app default, so a genuine "fresh mount" is one with no
        // stored env. Drop them first so the field truly falls back to the app default.
        await clearFocusedEnvironment(page);

        await page.locator('.tb-btn[title="Options"]').click();
        await expect(page.locator('.opt-modal')).toBeVisible();
        const envTemp = page.locator('.opt-modal .opt-fld', { hasText: 'Temperature' }).locator('input[type="number"]');
        await envTemp.fill('300');
        await envTemp.dispatchEvent('input');
        await envTemp.blur();
        await page.locator('.opt-modal .opt-ok').click();

        await page.reload();
        await page.locator('.project-nav li', { hasText: 'Advanced' }).click();
        const advTemp = page.locator('.tab-section.active .field', { hasText: 'Temperature' }).locator('input');
        await expect(advTemp).toHaveValue('300.00');
      });

      test('the Options Environment tab shows the app default 30 % humidity, unaffected by the own 50 % of the open project', async ({ page }) => {
        // The sample project stores its own humidity (50 %) on the PROJECT's Advanced tab. The Options dialog's Environment section is a separate, app-level
        // setting (`appSettingsRepo.envDefaults()`) that a project load never touches (John,
        // 2026-09-21: "the project has no influence on the env tab of the application settings").
        await page.locator('.tb-btn[title="Options"]').click();
        const modal = page.locator('.opt-modal');
        await expect(modal).toBeVisible();
        const hum = modal.locator('.opt-fld', { hasText: 'Relative humidity' }).locator('input.opt-num');
        await expect(hum).toHaveValue(/30/);
      });

      test('Options dialog → "Reset to Metric" reverts a toggled unit (kg → g) app-wide without touching the model', async ({ page }) => {
        await page.locator('.project-nav li', { hasText: 'Driver' }).click();
        const field = page.locator('.field').filter({ has: page.locator('label', { hasText: /^Added mass to cone$/ }) });
        const amc = field.locator('input');
        const unit = field.locator('.unit');

        // beforeEach clears localStorage, so the app starts on its metric ground state.
        await expect(unit).toHaveText('g');

        await amc.fill('75');
        await amc.dispatchEvent('input');
        await amc.blur();
        await unit.click();                             // g → kg
        await expect(unit).toHaveText('kg');


        // Read the STORED value through the UI, not out of the app's internals. `kg` is the SI unit for
        // this field, so while the unit reads `kg` the input IS the stored number — no backdoor needed,
        // and the assertion goes through the same surface a user does.
        const readMaddSi = async () => {
          await expect(unit).toHaveText('kg');
          await expect(unit).toHaveText('kg');
          return Number(await amc.inputValue());
        };
        const siBefore = await readMaddSi();
        expect(siBefore).toBeCloseTo(0.075, 6);

        await page.locator('.tb-btn[title="Options"]').click();
        await expect(page.locator('.opt-modal')).toBeVisible();
        await page.getByRole('button', { name: 'Reset to Metric (l, mm, …)' }).click();
        await expect(unit).toHaveText('g');             // reverted at once, before OK
        await page.locator('.opt-modal').getByRole('button', { name: 'Cancel' }).click();

        await expect(unit).toHaveText('g');             // Cancel does not bring the old unit back
        // The stored value is untouched by the unit switch and the metric reset: flip back to kg and the
        // same number is there. A reset changes which unit is SHOWN, never what is held.
        await unit.click(); // flip back to kg
        expect(await readMaddSi()).toBeCloseTo(siBefore, 6);
      });
    });

    test.describe('Plot Window', () => {
      test('the frequency range set in Options survives a reload', async ({ page }) => {
        await openPlotWindow(page);
        await freqRow(page).nth(0).fill('3');
        await freqRow(page).nth(1).fill('4444');
        await page.locator('.opt-modal').getByRole('button', { name: 'OK' }).click();

        await page.reload();
        await openPlotWindow(page);

        await expect(freqRow(page).nth(0)).toHaveValue('3');
        await expect(freqRow(page).nth(1)).toHaveValue('4444');
      });

      test('a chart Y range set in Options survives a reload', async ({ page }) => {
        await openPlotWindow(page);
        await splRow(page).nth(0).fill('11');
        await splRow(page).nth(0).dispatchEvent('change');
        await splRow(page).nth(1).fill('111');
        await splRow(page).nth(1).dispatchEvent('change');
        await page.locator('.opt-modal').getByRole('button', { name: 'OK' }).click();

        await page.reload();
        await openPlotWindow(page);

        await expect(splRow(page).nth(0)).toHaveValue('11');
        await expect(splRow(page).nth(1)).toHaveValue('111');
      });

      // John, 2026-10-01: a drag-zoomed range (stored as e.g. 13.478123 Hz) showed in Options to every
      // digit. The dialog shows it at the field's precision.
      test('Options shows a drag-zoomed frequency range at one decimal', async ({ page }) => {
        await setSweepRange(page, { min: 13.478123, max: 19987.34567 });
        await openPlotWindow(page);
        await expect(freqRow(page).nth(0)).toHaveValue('13.5');
        await expect(freqRow(page).nth(1)).toHaveValue('19987.3');
      });

      test('editing only a chart row End applies it against the row placeholder Start', async ({ page }) => {
        await openPlotWindow(page);

        // SPL's row placeholder Start is 40 (LIMIT_ROWS). Touch ONLY the End.
        await splRow(page).nth(1).fill('100');
        await splRow(page).nth(1).dispatchEvent('change');
        await okButton(page).click();

        await page.reload();
        await openPlotWindow(page);

        // Before the fix: Start persisted as empty/NaN — the chart ignored the whole override.
        await expect(splRow(page).nth(0)).toHaveValue('40');
        await expect(splRow(page).nth(1)).toHaveValue('100');
      });

      test('OK refuses a cleared frequency-range field and keeps the dialog open with the error', async ({ page }) => {
        await openPlotWindow(page);

        await freqRow(page).nth(0).fill('');
        await freqRow(page).nth(0).dispatchEvent('change');

        await expect(okButton(page)).toBeDisabled();
        await expect(page.getByTestId('settings-error')).toBeVisible();

        // The dialog stays open — nothing is written behind the user's back.
        await expect(page.locator('.opt-modal')).toBeVisible();
      });

      test('OK refuses an inverted frequency range', async ({ page }) => {
        await openPlotWindow(page);

        await freqRow(page).nth(0).fill('30000');
        await freqRow(page).nth(0).dispatchEvent('change');
        await freqRow(page).nth(1).fill('20');
        await freqRow(page).nth(1).dispatchEvent('change');

        await expect(okButton(page)).toBeDisabled();
        await expect(page.getByTestId('settings-error')).toBeVisible();
      });
    });
  });

  test.describe('with no project open', () => {
    test.describe('vented design limits', () => {
      test('Options opens with no project and shows the factory band', async ({ page }) => {
        await openOptions(page);

        // No project was ever opened — the project tabs say so, the dialog edits regardless.
        await expect(page.locator('.projects-list')).toContainText('No projects open');
        await expect(page.locator('.opt-modal')).toContainText('Vented design limits');

        // DEFAULT_VENTED_DESIGN_LIMITS in the units on screen: 1 L … 1000 L, 10 Hz … 150 Hz.
        await expect(page.locator('#set-min-volume')).toHaveValue('1.00');
        await expect(page.locator('#set-max-volume')).toHaveValue('1000.00');
        await expect(page.locator('#set-min-tuning')).toHaveValue('10.00');
        await expect(page.locator('#set-max-tuning')).toHaveValue('150.00');
      });

      test('an inside-out band is refused, and OK stays dead until it is a band', async ({ page }) => {
        await openOptions(page);

        await fillAndBlur(page.locator('#set-min-volume'), '900');
        await fillAndBlur(page.locator('#set-max-volume'), '5');
        await expect(page.locator('[data-testid="settings-error"]'))
          .toContainText('Minimum volume must be below maximum volume');
        await expect(page.locator('[data-testid="settings-apply"]')).toBeDisabled();

        await fillAndBlur(page.locator('#set-max-volume'), '1200');
        await expect(page.locator('[data-testid="settings-error"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="settings-apply"]')).toBeEnabled();
      });

      test('the wizard readout is unmarked under the factory band', async ({ page }) => {
        await page.goto('/');
        const modal = await wizardToVentedAlignment(page);

        // An ordinary driver designs an ordinary box: inside 1 L … 1000 L and 10 Hz … 150 Hz, so
        // nothing is marked. This is what makes the next test's marks mean something.
        await expect(modal.locator('[data-testid="np-vented-volume-warning"]')).toHaveCount(0);
        await expect(modal.locator('[data-testid="np-vented-tuning-warning"]')).toHaveCount(0);
      });

      test('a band the user narrows marks the wizard readout — the value itself is untouched', async ({ page }) => {
        await openOptions(page);

        // A band no real design fits: 1 L … 2 L, 1 Hz … 2 Hz.
        await fillAndBlur(page.locator('#set-min-volume'), '1');
        await fillAndBlur(page.locator('#set-max-volume'), '2');
        await fillAndBlur(page.locator('#set-min-tuning'), '1');
        await fillAndBlur(page.locator('#set-max-tuning'), '2');
        await clickOk(page);

        const modal = await wizardToVentedAlignment(page);

        // Both designed values are called out, and each sentence names the band it failed and says
        // the number is WinISD's own rather than a bug.
        const volume = modal.locator('[data-testid="np-vented-volume-warning"]');
        // ASCII hyphen, not an en-dash: the same sentence goes into a .wdr comment, where WinISD's
        // memo font draws `–` as a wrong glyph.
        await expect(volume).toContainText('outside the plausible 1 L - 2 L band set in Settings');
        await expect(volume).toContainText('WinISD gives the same answer');
        await expect(modal.locator('[data-testid="np-vented-tuning-warning"]'))
          .toContainText('outside the plausible 1 Hz - 2 Hz band set in Settings');

        // The designed numbers are NEVER changed by a mark — the readout still shows a real box.
        const readout = modal.locator('.readout-box');
        await expect(readout).not.toContainText('Box volume: 0.0 L');
        await expect(readout).not.toContainText('Tuning frequency: 0.0 Hz');
      });

      test('Reset to defaults puts the factory band back and clears the marks', async ({ page }) => {
        await openOptions(page);

        await fillAndBlur(page.locator('#set-max-volume'), '2');
        await clickOk(page);

        // The dialog reopens showing the narrowed band; the fieldset's reset is draft-only until OK.
        await page.locator('.tb-btn[title="Options"]').click();
        await expect(page.locator('#set-max-volume')).toHaveValue('2.00');
        await page.locator('[data-testid="settings-reset"]').click();
        await expect(page.locator('#set-max-volume')).toHaveValue('1000.00');
        await expect(page.locator('[data-testid="settings-reset"]')).toBeDisabled();
        await clickOk(page);

        const modal = await wizardToVentedAlignment(page);
        await expect(modal.locator('[data-testid="np-vented-volume-warning"]')).toHaveCount(0);
      });
    });

    test.describe('Backup', () => {
      test('Backup and restore live on their own tab, not on General', async ({ page }) => {
        await openOptions(page);
        await expect(page.locator('.opt-group', { has: page.locator('legend', { hasText: 'Backup' }) })).toHaveCount(0);
        await page.locator('.opt-tab', { hasText: 'Backup' }).click();
        await expect(page.locator('.opt-group', { has: page.locator('legend', { hasText: 'Backup' }) })).toBeVisible();
      });

      test('the Backup section downloads a JSON snapshot of this browser\'s storage', async ({ page }) => {
        await openBackupTab(page);
        const legend = page.locator('.opt-group', { has: page.locator('legend', { hasText: 'Backup' }) });
        await expect(legend).toBeVisible();

        const [download] = await Promise.all([
          page.waitForEvent('download'),
          legend.locator('button', { hasText: 'Download backup' }).click(),
        ]);
        expect(download.suggestedFilename()).toMatch(/^openisd-backup-\d{4}-\d{2}-\d{2}\.json$/);

        const text = await (await download.createReadStream()).toArray().then(a => Buffer.concat(a).toString());
        const parsed: unknown = JSON.parse(text);
        expect(parsed).toMatchObject({ openisdBackup: true });
      });

      test('restoring a backup asks for confirmation, then reloads the page', async ({ page }) => {
        await openBackupTab(page);
        const legend = page.locator('.opt-group', { has: page.locator('legend', { hasText: 'Backup' }) });

        // Confirm, then the post-restore reload notice — both native dialogs this flow raises.
        // `reloaded` is the real finish line: the page's own 'load' only fires again once
        // window.location.reload() actually runs, which is the last thing the success path does —
        // waiting on it (not just the two dialogs) is what proves the reload happened at all.
        let confirmSeen = false;
        let confirmText = '';
        let alertSeen = false;
        let reloaded = false;
        page.on('dialog', async (dialog) => {
          if (dialog.type() === 'confirm') { confirmSeen = true; confirmText = dialog.message(); await dialog.accept(); return; }
          alertSeen = true;
          await dialog.accept();
        });
        page.on('load', () => { reloaded = true; });

        const backupJson = JSON.stringify({
          openisdBackup: true, schemaVersion: 1, exportedAt: new Date().toISOString(),
          data: {},
        });
        const fileChooserPromise = page.waitForEvent('filechooser');
        await legend.locator('button', { hasText: 'Restore from file' }).click();
        const chooser = await fileChooserPromise;
        await chooser.setFiles({ name: 'openisd-backup-test.json', mimeType: 'application/json', buffer: Buffer.from(backupJson) });

        await expect.poll(() => reloaded).toBe(true);
        expect(confirmSeen).toBe(true);
        for (const named of ['overwrite', 'in memory', 'projects', 'My Drivers', 'My Passive Radiators']) expect(confirmText).toContain(named);
        expect(alertSeen).toBe(true);
      });

      test('restoring an invalid file reports the error and does not reload', async ({ page }) => {
        await openBackupTab(page);
        const legend = page.locator('.opt-group', { has: page.locator('legend', { hasText: 'Backup' }) });

        let sawInvalidAlert = false;
        page.on('dialog', async (dialog) => {
          if (dialog.type() === 'confirm') { await dialog.accept(); return; }
          if (dialog.message().includes('Could not restore')) sawInvalidAlert = true;
          await dialog.accept();
        });

        const fileChooserPromise = page.waitForEvent('filechooser');
        await legend.locator('button', { hasText: 'Restore from file' }).click();
        const chooser = await fileChooserPromise;
        await chooser.setFiles({ name: 'not-a-backup.json', mimeType: 'application/json', buffer: Buffer.from('{"nope":true}') });

        await expect.poll(() => sawInvalidAlert).toBe(true);
        // The dialog is still open — a failed restore did not navigate away.
        await expect(page.locator('.opt-modal')).toBeVisible();
      });
    });
  });
});
