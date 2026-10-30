import type {Locator, Page} from '@playwright/test';
import {expect, test, openAMobileProject, openAProject, COMPLETE_DRIVER_PROJECT_OWPR} from '../fixtures.js';
import {forceMobileSkin, openMobileMenu} from '../fixtures/mobileSkin.js';
import {measureCursorOrdinaryInk} from '../fixtures/fieldCursorContract.js';

/** Every currently rendered editable numeric value is tested, including empty states. This
 * is cursor coverage, not a substitute for independent whole-page field inventories. */
async function auditNumericCursors(surface: Locator): Promise<string[]> {
  const issues: string[] = [];
  const inputs = surface.locator('input[data-numinput]:visible:not([readonly])');
  const states = await inputs.evaluateAll(elements => elements.map((element, index) => {
    if (!(element instanceof HTMLInputElement)) throw new Error('Expected numeric input');
    return {index, digit: element.value.search(/\d/)};
  }));
  let checked = 0;
  for (const state of states.filter(item => item.digit >= 0)) {
    const input = inputs.nth(state.index);
    await input.focus();
    await input.evaluate((element, at) => { if (element instanceof HTMLInputElement) element.setSelectionRange(at, at + 1); }, state.digit);
    await expect(input.locator('..').locator('.num-mark-underline')).toBeVisible();
    const report = await input.evaluate(measureCursorOrdinaryInk);
    if (report.markers !== 1) issues.push(`input ${state.index}: cursor was not measured`);
    issues.push(...report.issues.map(issue => `input ${state.index}: ${issue}`));
    checked++;
  }
  for (const state of states.filter(item => item.digit < 0)) {
    const input = inputs.nth(state.index);
    await input.focus();
    await expect(input.locator('..').locator('.num-mark-underline')).toHaveCount(0);
    checked++;
  }
  await test.info().attach('cursor-audit', {body: JSON.stringify({mountedEditableNumbers: states.length, numeric: states.filter(state => state.digit >= 0).length, empty: states.filter(state => state.digit < 0).length, checked}), contentType: 'application/json'});
  expect(checked).toBe(states.length);
  await expect(inputs).toHaveCount(checked);
  return issues;
}

const hosts = [
  {skin: 'phone', prepare: async (page: Page) => { await page.setViewportSize({width: 374, height: 705}); await forceMobileSkin(page); }, open: openAMobileProject, nav: '.mob-tab', surface: '.mob-content', box: '#mob-box-type'},
  {skin: 'desktop', prepare: (page: Page) => page.setViewportSize({width: 1280, height: 900}), open: openAProject, nav: '.project-nav li', surface: '.tab-section.active', box: '#og-box-type'},
];
for (const host of hosts) {
  test.describe(host.skin + ' cursor contract', () => {
    test.beforeEach(async ({page}) => {
      await host.prepare(page);
      await page.goto('/');
      await host.open(page, COMPLETE_DRIVER_PROJECT_OWPR);
    });

    const views = host.skin === 'phone' ? ['Box', 'Driver', 'Signal', 'Filters', 'Graph'] : ['Box', 'Driver', 'Signal', 'Filters', 'Advanced', 'Project'];
    for (const tab of views) {
      test(tab + ': every displayed numeric cursor preserves ordinary ink', async ({page}) => {
        await page.locator(host.nav).filter({hasText: new RegExp('^' + tab + '$')}).click();
        expect(await auditNumericCursors(page.locator(host.surface))).toEqual([]);
      });
    }
    for (const box of ['vented', 'box-passive-radiator', 'bandpass4', 'bandpass6', 'abc']) {
      test(box + ': every numeric cursor preserves ordinary ink', async ({page}) => {
        await page.locator(host.nav).filter({hasText: /^Box$/}).click();
        await page.locator(host.box).selectOption(box);
        expect(await auditNumericCursors(page.locator(host.surface))).toEqual([]);
      });
    }
    for (const tab of ['General', 'Parameters', 'Advanced', 'Dimensions']) {
      test('Driver Editor ' + tab + ': every numeric cursor preserves ordinary ink', async ({page}) => {
        await page.locator(host.nav).filter({hasText: /^Driver$/}).click();
        await page.getByRole('button', {name: /^(?:✎ )?Edit$/}).click();
        const modal = page.locator('.de-modal');
        await modal.getByRole('button', {name: tab, exact: true}).click();
        expect(await auditNumericCursors(modal)).toEqual([]);
      });
    }

    test('Allpass: every numeric cursor preserves ordinary ink', async ({page}) => {
      await page.locator(host.nav).filter({hasText: /^Filters$/}).click();
      await page.getByText('+ AP', {exact: true}).click();
      expect(await auditNumericCursors(page.locator(host.surface))).toEqual([]);
    });
  });
}

test('phone Advanced: every displayed numeric cursor preserves ordinary ink', async ({page}) => {
  await hosts[0]!.prepare(page);
  await page.goto('/');
  await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
  await openMobileMenu(page);
  await page.locator('.mob-menu-item', {hasText: 'Advanced'}).click();
  expect(await auditNumericCursors(page.locator('.mob-content'))).toEqual([]);
});

for (const mode of ['Tune', 'What-if']) {
  test(mode + ': every sheet cursor preserves ordinary ink', async ({page}) => {
    await hosts[0]!.prepare(page);
    await page.goto('/');
    await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
    await page.locator('.mob-tab').filter({hasText: /^Graph$/}).click();
    await page.getByRole('button', {name: 'Open ' + mode}).click();
    expect(await auditNumericCursors(page.locator('.mob-sheet'))).toEqual([]);
  });
}


for (const mutation of [
  {name: 'ordinary ink change', property: 'color', value: 'magenta', issue: 'cursor changes ordinary value ink'},
  {name: 'one millisecond cycle change', property: 'animation-duration', value: '999ms', issue: 'cursor cycle duration differs from the decided one second'},
  {name: 'finite blink count', property: 'animation-iteration-count', value: '1', issue: 'cursor must keep blinking while selected'},
]) {
  test('the same cursor oracle rejects an injected ' + mutation.name, async ({page}) => {
    await page.goto('/?field-catalogue=1');
    const row = page.locator('[data-specimen="number-writable-none-none"]'), input = row.locator('input');
    await input.focus();
    await input.evaluate(element => { if (element instanceof HTMLInputElement) element.setSelectionRange(0, 1); });
    await expect(row.locator('.num-mark-underline')).toBeVisible();
    expect((await input.evaluate(measureCursorOrdinaryInk)).issues).toEqual([]);
    await row.locator('.num-mark-underline').evaluate((element, change) => element.style.setProperty(change.property, change.value, 'important'), mutation);
    expect((await input.evaluate(measureCursorOrdinaryInk)).issues).toContain(mutation.issue);
  });
}
