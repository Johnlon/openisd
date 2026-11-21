import type {Page} from '@playwright/test';
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';
import {fillAndCommit, PageOps} from '../fixtures/numField.js';
import {phoneTab} from '../fixtures/viewOpenNavigation.js';
import {SHARED_STEPS} from '../fixtures/viewOpenShared.js';
import {WalkSkin, WALK_VIEWPORT} from '../fixtures/viewOpenTypes.js';

const blockedSteps = SHARED_STEPS.filter(([, id]) => id === 'shared/graph-blocked-message');
const setUnreachableTuning = {
  [WalkSkin.Phone]: async (page: Page) => {
    await phoneTab(page, 'Box');
    await page.locator('#mob-box-type').selectOption('vented');
    await fillAndCommit(mobileFieldRow(page, 'Fb').locator('input'), '200');
    await phoneTab(page, 'Graph');
  },
  [WalkSkin.Desktop]: async (page: Page) => {
    await new PageOps(page).setNum('#og-fb-target', '200');
  },
};

for (const [skin, , step] of blockedSteps) {
  test.describe(`Blocked chart on ${skin}`, () => {
    test.use({viewport: WALK_VIEWPORT[skin]});

    test.beforeEach(async ({page}) => {
      if (skin === WalkSkin.Phone) await forceMobileSkin(page, 'window');
      await page.goto('/');
      const openProject = skin === WalkSkin.Phone ? openAMobileProject : openAProject;
      await openProject(page);
      await expect(page.getByText(/Project imported/)).toBeHidden();
    });

    test('opens the driver editor on Parameters from the repair button', async ({page}) => {
      await step.open(page);
      const panel = page.locator('.gmsg').filter({hasText: 'Can’t plot SPL response'});
      await expect(panel).toBeVisible();
      const edit = panel.getByRole('button', {name: 'Edit driver parameters', exact: true});
      await expect(edit).toBeInViewport({ratio: 1});
      await expect.poll(() => panel.evaluate(el => [el.scrollWidth - el.clientWidth, el.scrollHeight - el.clientHeight])).toEqual([0, 0]);
      await edit.click();

      const editor = page.locator('.de-modal');
      await expect(editor).toBeVisible();
      await expect(editor.locator('[data-de-tab="Parameters"]')).toBeVisible();
    });

    test('offers no driver edit button when the vent length blocks the chart', async ({page}) => {
      await setUnreachableTuning[skin](page);
      const panel = page.locator('.gmsg').filter({hasText: 'Fix: Vent length'}).first();
      await expect(panel).toBeVisible();
      await expect(panel.getByRole('button', {name: 'Edit driver parameters', exact: true})).toHaveCount(0);
    });
  });
}
