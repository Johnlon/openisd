import {expect, test} from '../fixtures.js';
import {readFileSync} from 'node:fs';
import {fillAndBlur} from '../fixtures/numField.js';
import {SAMPLE_PROJECT_OWPR} from '../fixtures/sampleProject.js';

test.describe('No-project shell', () => {
  test.describe('toolbar and placeholders', () => {
    /**
     * The shell stays fully accessible with no project open.
     *
     * App.vue once rendered ONLY the shell when a project existed, so a cold start was a walled
     * gate: no toolbar, no Options, no Manage Drivers — just "Start a new project" and a file
     * input (PROMPT_RELEASE_HARDENING's empty state). A cold start now renders the full shell,
     * with the toolbar's global actions (New / Open / Options / Drivers / Info) live, and
     * placeholders for everything that needs a project: the chart area, the tab pane and the
     * project list.
     */

    const OWPR = SAMPLE_PROJECT_OWPR;

    async function coldStart(page: import('playwright').Page) {
      await page.goto('/');
    }

    test('a cold start renders the full shell with the three no-project placeholders', async ({ page }) => {
      await coldStart(page);

      // The shell itself is up — toolbar and window chrome — not a bare "no project is open" page.
      await expect(page.locator('.original-root')).toBeVisible();
      await expect(page.locator('.toolbar')).toBeVisible();

      // The chart area points at the path to a chart, the tab pane and the project list say
      // plainly that no project is open.
      await expect(page.locator('.graph-empty-h')).toHaveText('Open or Create a project for charts');
      await expect(page.locator('.content-panel')).toContainText('No projects open');
      await expect(page.locator('.projects-list')).toContainText('No projects open');
    });

    test('the empty chart shows the app logo and name above the open-project buttons', async ({ page }) => {
      await coldStart(page);

      const empty = page.locator('.graph-empty');
      const logo = empty.locator('.graph-empty-brand img[src="/icon.svg"]');
      const name = empty.locator('.graph-empty-brand', { hasText: 'OpenISD' });
      await expect(logo).toBeVisible();
      await expect(name).toBeVisible();
      const brandBox = await name.boundingBox();
      const actionsBox = await empty.locator('.graph-empty-actions').boundingBox();
      expect(brandBox && actionsBox && brandBox.y + brandBox.height <= actionsBox.y).toBe(true);
    });

    test('no project does not wall off the toolbar’s global actions', async ({ page }) => {
      await coldStart(page);

      await expect(page.locator('.original-root')).toBeVisible();

      // Manage Drivers opens the library, and Escape closes it again.
      await page.locator('.tb-btn[title^="Manage Drivers"]').click();
      await expect(page.locator('.wb-modal')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('.wb-modal')).toBeHidden();

      // Options opens fully editable (username, environment).
      await page.locator('.tb-btn[title="Options"]').click();
      const opt = page.locator('.opt-modal');
      await expect(opt).toBeVisible();
      await expect(opt.locator('input.opt-input[type="text"]')).toBeEnabled();
      const environment = opt.locator('.opt-group', { hasText: 'Environment' });
      const environmentInputs = environment.locator('input.opt-num');
      for (const index of [0, 1, 2]) {
        const input = environmentInputs.nth(index);
        const before = await input.inputValue();
        await fillAndBlur(input, '');
        await expect(input).toHaveValue(before);
      }
      await page.locator('.opt-tab', { hasText: 'Plot Window' }).click();
      // The Frequency-range row edits `presentationState.sweepRange`, which is app-wide and shared
      // by every open project (GraphPanel.vue) — so it is live with no project open, like the rest
      // of the Plot Window tab.
      const frequencyRange = opt.locator('tr', { hasText: 'Frequency range' });
      await expect(frequencyRange.locator('input').nth(0)).toBeEnabled();
      await expect(frequencyRange.locator('input').nth(1)).toBeEnabled();
      const transferMagnitude = opt.locator('tr', { hasText: 'Transfer func. magn.' });
      await expect(transferMagnitude.locator('input').nth(0)).toHaveValue('-30');
      await expect(transferMagnitude.locator('input').nth(1)).toHaveValue('6');
      const eqTransferMagnitude = opt.locator('tr', { hasText: 'EQ transfer func mag' });
      await expect(eqTransferMagnitude.locator('input').nth(0)).toHaveValue('-40');
      await expect(eqTransferMagnitude.locator('input').nth(1)).toHaveValue('20');
      const colorColumns = opt.locator('.opt-color-col');
      await expect(colorColumns).toHaveCount(2);
      await expect(colorColumns.nth(0)).toContainText('0 dB line');
      await expect(colorColumns.nth(0)).toContainText('-3dB line');
      await expect(colorColumns.nth(0)).toContainText('Background');
      await expect(colorColumns.nth(1)).toContainText('Other lines');
      await expect(colorColumns.nth(1)).toContainText('Labels');
      await expect(colorColumns.nth(1)).toContainText('Xmax limit');
      await expect(colorColumns.nth(0).locator('input[type="color"]').nth(0)).toHaveValue('#000000');
      await expect(colorColumns.nth(0).locator('input[type="color"]').nth(1)).toHaveValue('#808080');
      await expect(colorColumns.nth(0).locator('input[type="color"]').nth(2)).toHaveValue('#ffffff');
      await expect(colorColumns.nth(1).locator('input[type="color"]').nth(0)).toHaveValue('#3a7bd5');
      await expect(colorColumns.nth(1).locator('input[type="color"]').nth(1)).toHaveValue('#000000');
      await expect(colorColumns.nth(1).locator('input[type="color"]').nth(2)).toHaveValue('#ff0000');
      await expect(colorColumns.nth(1).locator('input[type="color"]').nth(3)).toHaveValue('#2e8b57');
      await page.keyboard.press('Escape');
      await expect(opt).toBeHidden();

      // New opens the wizard.
      await page.locator('.tb-btn[title^="New project"]').click();
      await expect(page.locator('.modal-titlebar', { hasText: 'New Project' })).toBeVisible();
      await expect(page.locator('.modal', { hasText: 'New Project' })).toContainText('Step 1 of 5');
    });

    test('the project-only toolbar buttons are greyed out but keep their span', async ({ page }) => {
      await coldStart(page);

      await expect(page.locator('.original-root')).toBeVisible();
      await expect(page.locator('.toolbar .tb-btn[title^="Save -"]')).toHaveClass(/disabled/);
      await expect(page.locator('.toolbar .tb-btn[title^="Revert"]')).toHaveClass(/disabled/);
    });

    test('opening a project from the shell input swaps the placeholders for the real shell', async ({ page }) => {
      await coldStart(page);

      await page.locator('.original-root input[type=file]').setInputFiles({
        name: 'sample-project.owpr',
        mimeType: 'application/json',
        buffer: readFileSync(OWPR),
      });

      // The project is open: the chart and the Box tab render, the placeholders are gone, and the
      // opened file is the project in the list (the row is named for the file it came from).
      await expect(page.locator('.graph-empty-h')).toHaveCount(0);
      await expect(page.locator('.content-panel')).toContainText('Box Type');
      await expect(page.locator('.projects-list')).toContainText('sample-project');
    });

    test('a new project uses WinISD Plot Window frequency defaults', async ({ page }) => {
      await coldStart(page);
      await page.locator('.original-root input[type=file]').setInputFiles({
        name: 'sample-project.owpr',
        mimeType: 'application/json',
        buffer: readFileSync(OWPR),
      });
      await page.locator('.tb-btn[title="Options"]').click();
      const opt = page.locator('.opt-modal');
      await page.locator('.opt-tab', { hasText: 'Plot Window' }).click();
      const frequency = opt.locator('tr', { hasText: 'Frequency range' });
      await expect(frequency.locator('input').nth(0)).toHaveValue('10');
      await expect(frequency.locator('input').nth(1)).toHaveValue('20000');
    });

    test('choosing a driver with no project opens the New Project wizard with that driver', async ({ page }) => {
      await coldStart(page);

      await page.locator('.tb-btn[title^="Manage Drivers"]').click();
      await page.locator('.ditem').first().click();
      await page.locator('.use-btn').click();

      await expect(page.locator('.modal-titlebar', { hasText: 'New Project' })).toBeVisible();
      await expect(page.locator('.modal', { hasText: 'Step 1 of 5' })).toContainText('Step 1 of 5');
    });
  });

  test.describe('opening a saved project', () => {
    /**
     * The no-project shell can open a saved project from disk.
     *
     * The shell remains mounted without a project, including its hidden file input.
     * bugs/archive/BUG_20260909_no_project_can_be_opened_from_a_file_when_none_is_open.md
     */

    const OWPR = SAMPLE_PROJECT_OWPR;

    test('the no-project shell opens a saved .owpr', async ({ page }) => {
      await page.goto('/');

      await expect(page.locator('.original-root')).toBeVisible();

      await page.locator('.original-root input[type=file]').setInputFiles({
        name: 'sample-project.owpr',
        mimeType: 'application/json',
        buffer: readFileSync(OWPR),
      });

      // The project is open: the shell renders, and the opened file is the project in the list
      // (the row is named for the file it came from, not the `label` inside it).
      await expect(page.locator('.original-root')).toBeVisible();
      await expect(page.locator('.projects-list')).toContainText('sample-project');
    });

    test('Open shows saved browser projects with Import from disk first', async ({ page }) => {
      await page.goto('/');

      await page.getByTitle('Open project', {exact: true}).click();
      const dialog = page.locator('.open-project-dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('button').first()).toHaveText('Import from disk');
      await expect(dialog.locator('.open-project-list')).toContainText('No saved project yet');
    });

    // bugs/archive/BUG_20260929_file-open-dialog-seeded-to-winisd.md — Import from disk opens the system
    // dialog with our own "OpenISD and WinISD files" filter, and the picked file opens as a project.
    test('Import from disk asks the system dialog for one OpenISD and WinISD filter and opens the pick', async ({ page }) => {
      await page.addInitScript((owpr: string) => {
        Object.assign(window, {
          showOpenFilePicker: async (options: unknown) => {
            document.documentElement.dataset.pickerOptions = JSON.stringify(options);
            return [{ getFile: async () => new File([owpr], 'picked-design.owpr') }];
          },
        });
      }, readFileSync(OWPR, 'utf8'));
      await page.goto('/');

      await page.getByTitle('Open project', {exact: true}).click();
      await page.locator('.open-project-dialog').getByRole('button', { name: 'Import from disk' }).click();

      await expect(page.locator('.projects-list')).toContainText('picked-design');
      const options: unknown = JSON.parse(await page.locator('html').getAttribute('data-picker-options') ?? 'null');
      expect(options).toEqual({
        multiple: false,
        types: [{
          description: 'OpenISD and WinISD files',
          accept: {
            'application/x-openisd-project': ['.owpr'],
            'application/x-winisd-project': ['.wpr'],
            'application/x-openisd-driver': ['.owdr'],
            'application/x-winisd-driver': ['.wdr'],
          },
        }],
      });
    });
  });

  test.describe('stored panels', () => {
    /**
     * A stored view can say the Tune panel or the Driver Editor was open. Reloading with no
     * project open must not reopen them: both read the focused project, and there is none, so
     * they threw `no project is focused` through the top-level gate's computed and left the
     * fault dialog up. Reported from https://openisd.app/ on 2026-09-25.
     *
     * The fixture's own console assertion is what catches the throw — these tests also state the
     * visible consequence, so a failure says which panel came back.
     */

    /** Boot with no project and a stored view that claims `key` was open. */
    async function bootWith(page: import('@playwright/test').Page, key: string): Promise<void> {
      await page.addInitScript(k => {
        localStorage.setItem('openisd_view', JSON.stringify({ui: {splashSeen: true, [k]: true}}));
      }, key);
      await page.goto('/');
      await expect(page.locator('.original-root')).toBeVisible();
    }

    test('a stored open Tune panel does not reopen when no project is open', async ({page}) => {
      await bootWith(page, 'originalTuneOpen');
      await expect(page.locator('.tune-panel')).toHaveCount(0);
    });

    test('a stored open Driver Editor does not reopen when no project is open', async ({page}) => {
      await bootWith(page, 'originalEditorOpen');
      await expect(page.locator('.de-modal')).toHaveCount(0);
    });
  });
});
