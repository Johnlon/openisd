import {expect, test} from '../fixtures.js';
import type {Page} from '@playwright/test';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {PIXEL_9} from '../fixtures/phoneSizes.js';

/**
 * The desktop New Project dialog's frame (T919; John, 19 Nov 2026, on the dialog's pictures: "I hate all the white space", "all the
 * blank space looks terrible", "maybe try putting the next button at the top too"; and his question what Number of drivers means
 * with Iso-Barik on):
 * - one size on every step (a dialog changing size is an anti-pattern), and no step leaves more than a quarter of the body empty;
 * - Back and Next (Create on the last step) at the top as well as the bottom, the same buttons acting the same;
 * - with Iso-Barik, a line under the driver count says the count is of pairs ("3 pairs = 6 drivers"); none for Standard;
 * - on a short window the body scrolls inside the dialog and both rows of buttons stay in view.
 */

const TEST_DRIVER = 'Tang Band W5-1138SMF';
const BOX_TYPES = ['sealed', 'vented', 'box-passive-radiator', 'bandpass4', 'bandpass6', 'abc'] as const;

const modal = (page: Page) => page.locator('.overlay.open .modal');
const top = (page: Page) => page.getByTestId('np-nav-top');
const bottom = (page: Page) => page.locator('.overlay.open .modal-footer');

async function open(page: Page): Promise<void> {
  await page.setViewportSize({width: 1600, height: 1000});
  await page.goto('/');
  await page.locator('.tb-btn[title*="New project"]').click();
  await expect(page.locator('.np-step')).toContainText('Step 1 of 5');
}

/** The dialog's height, and how much of its body is empty below the last thing drawn in it. */
async function frame(page: Page): Promise<{modal: number; body: number; empty: number}> {
  return page.locator('.overlay.open .modal-body').evaluate(body => {
    const b = body.getBoundingClientRect();
    let bottomEdge = b.top;
    for (const el of body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden') bottomEdge = Math.max(bottomEdge, Math.min(r.bottom, b.bottom));
    }
    const m = body.closest('.modal');
    if (m === null) throw new Error('the body has no dialog');
    return {modal: Math.round(m.getBoundingClientRect().height), body: b.height, empty: b.bottom - bottomEdge};
  });
}

test.describe('Desktop New Project dialog frame', () => {
  test('every step, every box type: one dialog height, and no step leaves more than a quarter of the body empty', async ({page}) => {
    await open(page);
    const heights = new Set<number>();
    const check = async (where: string) => {
      const f = await frame(page);
      heights.add(f.modal);
      expect(f.empty, `${where}: empty ${Math.round(f.empty)} px of a ${Math.round(f.body)} px body`).toBeLessThanOrEqual(f.body / 4);
    };
    const next = bottom(page).getByRole('button', {name: 'Next', exact: true});
    const back = bottom(page).getByRole('button', {name: 'Back', exact: true});
    await check('step 1, the driver list');
    await page.locator('.overlay.open .modal-body').getByText(TEST_DRIVER).first().click();
    await next.click();
    await expect(page.locator('.np-step')).toContainText('Step 2 of 5');
    await check('step 2, Standard');
    await page.locator('#np-place-isobaric').check();
    await check('step 2, Iso-Barik');
    await next.click();
    // Every box type's step 3 and step 4; the sealed box (the last) goes on to step 5.
    for (const box of BOX_TYPES) {
      await expect(page.locator('.np-step')).toContainText('Step 3 of 5');
      await page.locator('#np-box-type').selectOption(box);
      await check(`step 3, ${box}`);
      await next.click();
      await expect(page.locator('.np-step')).toContainText('Step 4 of 5');
      await check(`step 4, ${box}`);
      await back.click();
    }
    await page.locator('#np-box-type').selectOption('sealed');
    await next.click();
    await next.click();
    await expect(page.locator('.np-step')).toContainText('Step 5 of 5');
    await check('step 5');
    expect([...heights], 'the dialog keeps one height on every step').toHaveLength(1);
  });

  test('Back and Next are at the top and the bottom, enabled alike, and the top ones move the wizard as the bottom ones do', async ({page}) => {
    await open(page);
    const pair = (name: string) => [top(page).getByRole('button', {name, exact: true}), bottom(page).getByRole('button', {name, exact: true})] as const;
    const [topBack, bottomBack] = pair('Back');
    const [topNext, bottomNext] = pair('Next');
    await expect(topBack).toBeVisible();
    await expect(topNext).toBeVisible();
    // Step 1, nothing chosen: Back and Next off in both places.
    await expect(topBack).toBeDisabled();
    await expect(bottomBack).toBeDisabled();
    await expect(topNext).toBeDisabled();
    await expect(bottomNext).toBeDisabled();
    await page.locator('.overlay.open .modal-body').getByText(TEST_DRIVER).first().click();
    await expect(topNext).toBeEnabled();
    await expect(bottomNext).toBeEnabled();
    // The top Next chooses the driver and moves on, as the bottom one does.
    await topNext.click();
    await expect(page.locator('.np-step')).toContainText('Step 2 of 5');
    await expect(topBack).toBeEnabled();
    await expect(bottomBack).toBeEnabled();
    await topNext.click();
    await expect(page.locator('.np-step')).toContainText('Step 3 of 5');
    await topBack.click();
    await expect(page.locator('.np-step')).toContainText('Step 2 of 5');
    await bottomNext.click();
    await expect(page.locator('.np-step')).toContainText('Step 3 of 5');
    await topNext.click();
    await topNext.click();
    await expect(page.locator('.np-step')).toContainText('Step 5 of 5');
    // The last step: Create in both places, and the top one makes the project.
    const [topCreate, bottomCreate] = pair('Create');
    await expect(topCreate).toBeEnabled();
    await expect(bottomCreate).toBeEnabled();
    await topCreate.click();
    await expect(modal(page)).toHaveCount(0);
    await expect(page.getByText('No projects open')).toBeHidden();
  });

  test('with Iso-Barik the driver count says it counts pairs; with Standard it says nothing', async ({page}) => {
    await open(page);
    await page.locator('.overlay.open .modal-body').getByText(TEST_DRIVER).first().click();
    await bottom(page).getByRole('button', {name: 'Next', exact: true}).click();
    const note = page.getByTestId('np-pair-note');
    await expect(note).toBeHidden();
    await page.locator('#np-place-isobaric').check();
    await expect(note).toBeVisible();
    await expect(note).toHaveText('1 pair = 2 drivers');
    await page.locator('#np-ndrivers').selectOption('3');
    await expect(note).toHaveText('3 pairs = 6 drivers');
    await page.locator('#np-place-isobaric-tandem').check();
    await expect(note).toHaveText('3 pairs = 6 drivers');
    await page.locator('#np-place-standard').check();
    await expect(note).toBeHidden();
  });

  test('720 px and 520 px windows: the passive radiator step scrolls inside the dialog and both rows of buttons stay in view', async ({page}) => {
    await open(page);
    await page.setViewportSize({width: 1280, height: 720});
    await page.locator('.overlay.open .modal-body').getByText(TEST_DRIVER).first().click();
    const next = bottom(page).getByRole('button', {name: 'Next', exact: true});
    await next.click();
    await next.click();
    await page.locator('#np-box-type').selectOption('box-passive-radiator');
    await next.click();
    await expect(page.locator('.np-step')).toContainText('Step 4 of 5');
    const buttons = [top(page).getByRole('button', {name: 'Back', exact: true}), top(page).getByRole('button', {name: 'Next', exact: true}),
      bottom(page).getByRole('button', {name: 'Back', exact: true}), next, bottom(page).getByRole('button', {name: 'Cancel', exact: true})];
    for (const b of buttons) await expect(b).toBeInViewport({ratio: 1});
    // A window shorter than the dialog: the body is what scrolls, the last radiator row can be scrolled to, the buttons stay.
    await page.setViewportSize({width: 1280, height: 520});
    const body = page.locator('.overlay.open .modal-body');
    expect(await body.evaluate(b => b.scrollHeight > b.clientHeight), 'the step is taller than the body, so the body scrolls').toBe(true);
    await page.locator('#np-pr-xmax').scrollIntoViewIfNeeded();
    await expect(page.locator('#np-pr-xmax')).toBeInViewport();
    for (const b of buttons) await expect(b).toBeInViewport({ratio: 1});
    const box = await modal(page).boundingBox();
    expect(box, 'the dialog is drawn').not.toBeNull();
    expect((box?.y ?? 0) + (box?.height ?? 0), 'the dialog ends inside the window').toBeLessThanOrEqual(520);
  });
});

/** Steps 3 and 4 draw the box with the ONE arrangement picked on step 2, never both Iso-Barik ones (the lead, 20 Nov 2026, on the
 * step 4 picture: John objected to the Box tab drawing an arrangement that was chosen elsewhere). */
const ARRANGEMENTS = [['standard', 'single'], ['isobaric', 'clamshell'], ['isobaric-tandem', 'tandem']] as const;

test.describe('Desktop New Project box drawing', () => {
  for (const [value, art] of ARRANGEMENTS) {
    test(`${art} picked: step 3 draws only the ${art} box`, async ({page}) => {
      await open(page);
      await page.locator('.overlay.open .modal-body').getByText(TEST_DRIVER).first().click();
      const next = bottom(page).getByRole('button', {name: 'Next', exact: true});
      await next.click();
      await page.locator(`#np-place-${value}`).check();
      // Model B (the dialog's height follows its step): only step 3 draws the box on the desktop, as on main.
      for (const step of ['Step 3 of 5']) {
        await next.click();
        await expect(page.locator('.np-step')).toContainText(step);
        const drawings = page.locator('.overlay.open .modal-body').getByTestId('box-arrangement-drawing');
        await expect(drawings, `${step}: one box drawing`).toHaveCount(1);
        await expect(drawings).toHaveAttribute('data-art', art);
        await expect(drawings.locator('svg:visible'), `${step}: one box drawn`).toHaveCount(1);
      }
    });
  }
});

test.describe('Phone New project wizard', () => {
  test.use({viewport: PIXEL_9});

  test('with Iso-Barik the driver count says it counts pairs; with Standard it says nothing', async ({page}) => {
    await forceMobileSkin(page);
    await page.goto('/');
    await page.getByText('New project').first().click();
    await page.locator('.mob-np-body').getByText(TEST_DRIVER).first().click();
    await page.locator('.mob-np-footer').getByText('Next ▸', {exact: true}).click();
    const note = page.getByTestId('np-pair-note');
    await expect(note).toHaveCount(0);
    await page.locator('#np-placement').selectOption('isobaric');
    await expect(note).toHaveText('1 pair = 2 drivers');
    await page.locator('#np-ndrivers').selectOption('3');
    await expect(note).toHaveText('3 pairs = 6 drivers');
    await page.locator('#np-placement').selectOption('standard');
    await expect(note).toHaveCount(0);
  });

  for (const [value, art] of ARRANGEMENTS) {
    test(`${art} picked: steps 3 and 4 draw only the ${art} box`, async ({page}) => {
      await forceMobileSkin(page);
      await page.goto('/');
      await page.getByText('New project').first().click();
      await page.locator('.mob-np-body').getByText(TEST_DRIVER).first().click();
      const next = page.locator('.mob-np-footer').getByText('Next ▸', {exact: true});
      await next.click();
      await page.locator('#np-placement').selectOption(value);
      for (let i = 0; i < 2; i++) {
        await next.click();
        const drawings = page.locator('.mob-np-body').getByTestId('box-arrangement-drawing');
        await expect(drawings).toHaveCount(1);
        await expect(drawings).toHaveAttribute('data-art', art);
        await expect(drawings.locator('svg:visible')).toHaveCount(1);
      }
    });
  }
});
