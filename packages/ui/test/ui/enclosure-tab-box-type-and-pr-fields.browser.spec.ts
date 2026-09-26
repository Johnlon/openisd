/**
 * Box Type is chosen on the Box tab, and nowhere else. The enclosure tab (Vents, or the
 * passive radiator) carried a second copy of the selector, which put the PR's own identity row
 * — [Select PR] [Edit] — a row below a control that has nothing to do with the PR.
 *
 * And the passive radiator's parameters are edited where they are shown, as WinISD does it:
 * Vas and Qms were readouts on the tab, editable only by opening the PR editor.
 */
import {expect, openAProject, test} from '../fixtures.js';

test.beforeEach(async ({page}) => {
  await page.goto('/');
  await openAProject(page);
});

/** Put the project in `boxType` and open the enclosure tab — its nav entry is named after the
 *  box type (`enclosureNavLabel`), so the caller says which label to click. */
async function enclosureTabFor(page: import('@playwright/test').Page, boxType: string, navLabel: string): Promise<void> {
  await page.locator('.project-nav li', {hasText: 'Box'}).click();
  await page.locator('#og-box-type').selectOption(boxType);
  await page.locator('.project-nav li', {hasText: navLabel}).click();
}

test('the Box tab owns the box-type selector', async ({page}) => {
  await page.locator('.project-nav li', {hasText: 'Box'}).click();
  await expect(page.locator('#og-box-type')).toBeVisible();
});

test('the vented enclosure tab has no box-type selector', async ({page}) => {
  await enclosureTabFor(page, 'vented', 'Vented');
  await expect(page.locator('#vent-count')).toBeVisible();          // we are on the vents pane
  await expect(page.locator('#og-box-type-enclosure')).toHaveCount(0);
});

test('the passive radiator tab has no box-type selector', async ({page}) => {
  await enclosureTabFor(page, 'box-passive-radiator', 'Passive Radiator');
  await expect(page.locator('#og-pr-fs')).toBeVisible();            // we are on the PR pane
  await expect(page.locator('#og-box-type-enclosure')).toHaveCount(0);
});

test('the PR tab edits Vas and Qms in place, without the editor popup', async ({page}) => {
  await enclosureTabFor(page, 'box-passive-radiator', 'Passive Radiator');

  const vas = page.locator('#og-pr-vas');
  const qms = page.locator('#og-pr-qms');
  await expect(vas).not.toHaveAttribute('readonly', /.*/);
  await expect(qms).not.toHaveAttribute('readonly', /.*/);

  await vas.fill('7.5');
  await vas.dispatchEvent('input');
  await qms.fill('12.25');
  await qms.dispatchEvent('input');

  const stored = await page.evaluate(async modPath => {
    const s = await import(/* @vite-ignore */ modPath);
    const p = s.requireFocusedProject();
    return {
      vas_m3: p.box.passiveRadiator.radiator.spec.Vas_m3.value,
      qms: p.box.passiveRadiator.radiator.spec.Qms.value,
    };
  }, '/src/logic/appState.ts');
  expect(stored.vas_m3).toBeCloseTo(0.0075, 6);   // the field shows litres
  expect(stored.qms).toBeCloseTo(12.25, 3);
});
