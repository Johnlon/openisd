/**
 * The New Project wizard's radiator step (QO442, John: A): a pick moves on to the project page, as
 * picking a driver does; the boxes are for defining a radiator by hand.
 * bugs/BUG_20261107_new-project-wizard-radiator-pane-shows-no-calculated-values.md
 */
import {expect, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

const HINT = 'Select a Passive Radiator or define one below';

test.describe('desktop', () => {
  test.beforeEach(async ({appPage: page}) => {
    await page.locator('.tb-btn[title*="New project"]').click();
    const modal = page.locator('.overlay.open');
    await modal.locator('.dlist .ditem').first().click();
    await modal.locator('.modal-footer').getByRole('button', {name: 'Next', exact: true}).click();
    await modal.locator('button', {hasText: 'Next'}).click();
    await modal.getByLabel('Box type').selectOption('box-passive-radiator');
    await modal.locator('button', {hasText: 'Next'}).click();
  });

  test('the step says to select a radiator or define one below', async ({appPage: page}) => {
    await expect(page.locator('.np-pr-hint')).toHaveText(HINT);
  });

  test('picking a radiator goes to the project page; Back shows the radiator picked', async ({appPage: page}) => {
    const footer = page.locator('.overlay.open .modal-footer');
    await page.locator('#np-pr-select').click();
    await page.locator('.pr-lib-item .pr-lib-name', {hasText: 'E150HE-PR'}).first().click();
    await expect(footer.getByRole('button', {name: 'Create'})).toBeVisible();
    await expect(page.locator('#np-pr-select')).toHaveCount(0);
    await footer.getByRole('button', {name: /Back/}).click();
    await expect(page.locator('#np-pr-name')).toHaveValue(/E150HE-PR/);
  });

  test('defining a radiator stays on the step, so its values can be typed', async ({appPage: page}) => {
    await page.locator('#np-pr-select').click();
    await page.locator('button', {hasText: 'Define new passive radiator'}).click();
    await expect(page.locator('#np-pr-vas')).toBeVisible();
    await expect(page.locator('#np-pr-vas')).toHaveValue('');
  });
});

test.describe('phone', () => {
  test.use({viewport: {width: 374, height: 705}});

  test.beforeEach(async ({page}) => {
    await forceMobileSkin(page);
    await page.goto('/');
    await page.getByText('New project').click();
    await page.getByText('Tang Band W5-1138SMF').click();
    const next = page.locator('.mob-np-footer').getByText('Next ▸', {exact: true});
    await next.click();
    await next.click();
    await page.locator('#np-box-type').selectOption('box-passive-radiator');
    await next.click();
  });

  test('the step shows the line whole, with nothing running off the side', async ({page}) => {
    const hint = page.locator('.np-pr-hint');
    await expect(hint).toHaveText(HINT);
    await expect(hint).toBeInViewport({ratio: 1});
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
  });

  test('picking a radiator goes to the project page; Back shows the radiator picked', async ({page}) => {
    const footer = page.locator('.mob-np-footer');
    await page.locator('#np-pr-select').click();
    await page.locator('.pr-lib-item .pr-lib-name', {hasText: 'E150HE-PR'}).first().click();
    await expect(footer.getByText(/Create/)).toBeVisible();
    await expect(page.locator('#np-pr-select')).toHaveCount(0);
    await footer.getByText(/Back/).click();
    await expect(page.locator('#np-pr-name')).toHaveValue(/E150HE-PR/);
  });
});
