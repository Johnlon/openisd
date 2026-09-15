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
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test, expect } from '../fixtures.js';

const OWPR = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'sample-project.owpr');

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

test('no project does not wall off the toolbar’s global actions', async ({ page }) => {
  await coldStart(page);

  await expect(page.locator('.original-root')).toBeVisible();

  // Manage Drivers opens the library, and Escape closes it again.
  await page.locator('.tb-btn[title^="Manage Drivers"]').click();
  await expect(page.locator('.wb-modal')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.wb-modal')).toBeHidden();

  // Options opens fully editable (username, environment) — the per-project sweep
  // Frequency-range row is hidden because there is no project to bind it to.
  await page.locator('.tb-btn[title="Options"]').click();
  const opt = page.locator('.opt-modal');
  await expect(opt).toBeVisible();
  await expect(opt.locator('input.opt-input[type="text"]')).toBeEnabled();
  const environment = opt.locator('.opt-group', { hasText: 'Environment' });
  const environmentInputs = environment.locator('input.opt-num');
  for (const index of [0, 1, 2]) {
    const input = environmentInputs.nth(index);
    const before = await input.inputValue();
    await input.fill('');
    await input.blur();
    await expect(input).toHaveValue(before);
  }
  await page.locator('.opt-tab', { hasText: 'Plot Window' }).click();
  await expect(opt).not.toContainText('Frequency range');
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
  await expect(page.locator('.modal', { hasText: 'New Project' })).toContainText('Step 1 of 3');
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
  await expect(page.locator('.modal', { hasText: 'Step 1 of 3' })).toContainText('Step 1 of 3');
});
