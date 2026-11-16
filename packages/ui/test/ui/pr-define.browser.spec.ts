/**
 * Issue 522 (John, 16 Nov 2026): "the define passive radiator button on the pr popup doesn't work at all".
 * It used to close the popup and swap a blank radiator into the project with no editor and no question.
 * Now it opens the passive-radiator editor on a NEW blank radiator, its name box focused; the project's radiator stays until
 * OK; Cancel changes nothing. Both skins and the New Project wizard's radiator step.
 * John, 16 Nov 2026 (QO946.c115, c117): the passive-radiator editor, as the driver editor. OK applies the radiator to the
 * project (it used to file it in the library only, PR 140); Copy to My PRs files it in My passive radiators.
 * bugs/BUG_20261115_define-passive-radiator-button-does-nothing.md
 */
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import type {Locator, Page} from '@playwright/test';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

const LOADED = 'ASP190';

async function loadRadiator(page: Page, opener: () => Promise<void>) {
  await opener();
  await page.locator('.pr-lib-item .pr-lib-name', {hasText: LOADED}).first().click();
  await expect(page.locator('.pr-filter')).toHaveCount(0);
}

function suite(skin: 'desktop' | 'phone') {
  /** Copy to My PRs: the desktop footer's button, the phone's More menu (as the driver editor). */
  const copyToMyPRs = async (editor: Locator) => {
    if (skin === 'desktop') { await editor.getByRole('button', {name: 'Copy to My PRs'}).click(); return; }
    await editor.getByRole('button', {name: /More/}).click();
    await editor.getByRole('menuitem', {name: 'Copy to My PRs'}).click();
  };
  /** The project's radiator name: a box on the desktop page, the editor row on the phone. */
  const expectName = async (page: Page, text: RegExp | string) => {
    if (skin === 'desktop') await expect(page.locator('#og-pr-name')).toHaveValue(text);
    else await expect(page.locator('#mob-pr-name-btn')).toContainText(text);
  };
  const select = (page: Page) => skin === 'desktop'
    ? page.locator('.edit-btn[title^="Browse bundled"]')
    : page.getByRole('button', {name: 'Select PR'});
  const open = async (page: Page) => { await select(page).click(); await page.locator('.pr-filter').waitFor(); };

  test.beforeEach(async ({appPage: page}) => {
    if (skin === 'phone') {
      await page.setViewportSize({width: 374, height: 705});
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
    await loadRadiator(page, () => open(page));
    await expectName(page, new RegExp(LOADED));
  });

  test('Define opens an editor on a blank radiator with its name focused; the project keeps its radiator', async ({appPage: page}) => {
    await open(page);
    await page.getByRole('button', {name: /Define new passive radiator/}).click();
    const editor = page.getByRole('dialog', {name: 'Define new passive radiator'});
    await expect(editor).toBeVisible();
    await expect(editor.locator('#pr-editor-name')).toBeFocused();
    await expect(editor.locator('#pr-editor-name')).toHaveValue('');
    await editor.getByRole('tab', {name: 'Parameters'}).click();
    await expect(editor.locator('#pr-editor-fs')).toHaveValue('');
    await expectName(page, new RegExp(LOADED));
    await editor.getByRole('button', {name: 'Cancel'}).click();
  });

  test('Cancel leaves the project and the library popup as they were', async ({appPage: page}) => {
    await open(page);
    await page.getByRole('button', {name: /Define new passive radiator/}).click();
    const editor = page.getByRole('dialog', {name: 'Define new passive radiator'});
    await editor.locator('#pr-editor-name').fill('Half typed');
    await editor.getByRole('button', {name: 'Cancel'}).click();
    await expect(editor).toHaveCount(0);
    await expect(page.locator('.pr-filter')).toBeVisible();
    await page.getByRole('button', {name: 'Done'}).click();
    await expectName(page, new RegExp(LOADED));
  });

  test('OK makes the new radiator the project\'s, and closes the popup', async ({appPage: page}) => {
    await open(page);
    await page.getByRole('button', {name: /Define new passive radiator/}).click();
    const editor = page.getByRole('dialog', {name: 'Define new passive radiator'});
    await editor.locator('#pr-editor-name').fill(`My new PR ${skin}`);
    await editor.getByRole('tab', {name: 'Parameters'}).click();
    await editor.locator('#pr-editor-fs').fill('21');
    await editor.locator('#pr-editor-vas').fill('60');
    await editor.locator('#pr-editor-fs').press('Tab');
    await expect(editor.locator('#pr-editor-vas')).toHaveValue('60.00');   // a typed figure stays in its box
    await editor.getByRole('button', {name: 'OK'}).click();
    await expect(editor).toHaveCount(0);
    await expect(page.locator('.pr-filter')).toHaveCount(0);
    await expectName(page, `My new PR ${skin}`);
  });

  test('Copy to My PRs files the new radiator in the library; the project keeps its own until OK', async ({appPage: page}) => {
    await open(page);
    await page.getByRole('button', {name: /Define new passive radiator/}).click();
    const editor = page.getByRole('dialog', {name: 'Define new passive radiator'});
    await editor.locator('#pr-editor-name').fill(`Filed PR ${skin}`);
    await copyToMyPRs(editor);
    await expect(editor.getByRole('status')).toContainText(`Filed PR ${skin}`);
    await editor.getByRole('button', {name: 'Cancel'}).click();
    await expect(page.locator('.pr-lib-item', {hasText: `Filed PR ${skin}`})).toBeVisible();
    await page.getByRole('button', {name: 'Done'}).click();
    await expectName(page, new RegExp(LOADED));
  });
}

test.describe('desktop', () => { suite('desktop'); });

test.describe('phone', () => { suite('phone'); });

test.describe('wizard step', () => {
  test.beforeEach(async ({appPage: page}) => {
    await page.locator('.tb-btn[title*="New project"]').click();
    const modal = page.locator('.overlay.open');
    await modal.locator('.dlist .ditem').first().click();
    await modal.locator('.modal-footer').getByRole('button', {name: 'Next', exact: true}).click();
    await modal.locator('button', {hasText: 'Next'}).click();
    await modal.getByLabel('Box type').selectOption('box-passive-radiator');
    await modal.locator('button', {hasText: 'Next'}).click();
  });

  test('Define opens the editor; Cancel keeps the radiator chosen, OK makes the new one the wizard\'s radiator', async ({appPage: page}) => {
    await page.locator('#np-pr-select').click();
    await page.locator('.pr-lib-item .pr-lib-name', {hasText: LOADED}).first().click();
    await page.locator('.overlay.open .modal-footer').getByRole('button', {name: /Back/}).click();
    await expect(page.locator('#np-pr-name')).toHaveValue(new RegExp(LOADED));

    await page.locator('#np-pr-select').click();
    await page.getByRole('button', {name: /Define new passive radiator/}).click();
    const editor = page.getByRole('dialog', {name: 'Define new passive radiator'});
    await expect(editor.locator('#pr-editor-name')).toBeFocused();
    await editor.getByRole('button', {name: 'Cancel'}).click();
    await page.getByRole('button', {name: 'Done'}).click();
    await expect(page.locator('#np-pr-name')).toHaveValue(new RegExp(LOADED));

    await page.locator('#np-pr-select').click();
    await page.getByRole('button', {name: /Define new passive radiator/}).click();
    await editor.locator('#pr-editor-name').fill('Wizard PR');
    await editor.getByRole('tab', {name: 'Parameters'}).click();
    await editor.locator('#pr-editor-xmax').fill('9');
    await editor.getByRole('button', {name: 'OK'}).click();
    await expect(editor).toHaveCount(0);
    await expect(page.locator('.pr-filter')).toHaveCount(0);
    await expect(page.locator('#np-pr-name')).toHaveValue('Wizard PR');
  });
});
