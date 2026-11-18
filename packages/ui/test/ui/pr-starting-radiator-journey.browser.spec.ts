import {expect, openTab, test} from '../fixtures.js';
import type {Page} from '@playwright/test';
import {PhoneWizardText} from '@openisd/design/fields';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

/**
 * Journey (T910): a person makes a project for 2 or 4 drivers in the phone wizard, then chooses the Passive Radiator box type on the
 * Box tab. The project starts with a placeholder radiator. Under the radiator's Key figures the "2x rule" line says what the radiators
 * must displace and how many of this radiator reach it; the placeholder radiator shown, times the Num. of PRs shown, must reach the
 * displacement the line asks for, and the line must not ask for more radiators than the project has. It would have caught
 * bugs/BUG_20261118_dummy-radiator-sized-by-a-1x-rule-the-2x-line-contradicts.md (T902): the placeholder was sized to 1x the drivers'
 * displacement, so the line beside it said "needs 2 of these". Acts only as a person does: the wizard, the Box type list, reading the tab.
 * Phone only: the "2x rule" line is drawn by the phone's Box tab; the desktop Box tab has no such line to compare with.
 * The wizard's own radiator step starts with no radiator at all (a pick or typed figures), so the placeholder is met on the Box tab.
 */

const DRIVER = 'W5-1138SMF';

/** Journeys that fail because of an app bug: the bug file, red until fixed (`test.fail`). Key: the test's title. */
const KNOWN: ReadonlyMap<string, string> = new Map([]);

async function makeProject(page: Page, drivers: number): Promise<void> {
  await forceMobileSkin(page);
  await page.goto('/');
  await page.getByText('New project').click();
  const root = page.locator('.mob-np-overlay');
  await expect(root).toBeVisible();
  const next = page.locator('.mob-np-footer').getByRole('button', {name: PhoneWizardText.NEXT, exact: true});
  await root.locator('input.filter').fill(DRIVER);
  await root.locator('.dlist .ditem', {hasText: DRIVER}).first().click();
  await next.click();
  await page.locator('#np-ndrivers').selectOption(String(drivers));
  await next.click();
  await root.locator('#np-box-type').selectOption('sealed');
  await next.click();
  await next.click();
  await page.locator('.mob-np-footer').getByRole('button', {name: PhoneWizardText.CREATE, exact: true}).click();
  await expect(root).toHaveCount(0);
  await openTab(page, 'Box');
}

test.describe('Journey: the starting passive radiator meets the 2x rule the Box tab states', () => {
  test.use({isMobile: true, hasTouch: true, viewport: {width: 374, height: 705}});

  for (const drivers of [2, 4]) {
    const name = `${drivers} drivers: the starting radiator meets the 2x rule line`;

    test(name, async ({page}) => {
      test.fail(KNOWN.has(name), KNOWN.get(name) ?? '');
      await makeProject(page, drivers);
      await page.locator('#mob-box-type').selectOption('box-passive-radiator');
      const line = (await page.locator('#mob-pr-two-times').innerText()).trim();
      const count = Number(await page.locator('#mob-pr-count').inputValue());
      const vd_cm3 = Number(await page.locator('#mob-pr-key-vd').inputValue());
      const required_cm3 = Number(/≥ (\d+) cm³/.exec(line)?.[1]);
      expect(Number.isFinite(required_cm3), `the line states a displacement: "${line}"`).toBe(true);
      expect(vd_cm3 * count + 1, `the radiator shows Vd ${vd_cm3} cm³ x ${count}; the line asks for ${required_cm3} cm³: "${line}"`).toBeGreaterThanOrEqual(required_cm3);
      expect(line, `the project has ${count} radiator(s)`).toMatch(count > 1 ? /of these/ : /1 of these is enough/);
    });
  }
});
