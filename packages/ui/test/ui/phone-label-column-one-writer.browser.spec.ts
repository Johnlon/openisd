/**
 * BUG_20261115_mobile-wizard-box-type-select-width-varies, second half (John, 15 Nov 2026: layout is deterministic).
 * The page's label column has one writer, the measure of its own labels. Once measured, a render of the page
 * (a box-type change) never shows the design's default column again, not even for a frame.
 */
import {z} from 'zod';
import {expect, test} from '../fixtures.js';
import {VisualSkin} from '../visual/screens.js';
import {PhoneRowColumns} from '@openisd/design/fields';

test('a render of the wizard page never puts the default label column back over the measured one', async ({page}) => {
  await VisualSkin.MOBILE.start(page);
  await page.getByText('New project').first().click();
  await page.locator('.mob-np-body .dlist .ditem').first().click();
  const next = page.locator('.mob-np-footer').getByText('Next ▸', {exact: true});
  await next.click();
  // The column the page's root shows after each change of its style, read as the change is reported.
  await page.evaluate(variable => {
    const root = document.querySelector<HTMLElement>('.mob-classic');
    if (root === null) throw new Error('no phone page');
    const record: string[] = [];
    Reflect.set(window, 'columnsSeen', record);
    new MutationObserver(() => record.push(root.style.getPropertyValue(variable))).observe(root, {attributes: true, attributeFilter: ['style']});
  }, PhoneRowColumns.LABEL_COLUMN_VAR);
  await next.click();
  const settled = (): Promise<void> => page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
  await settled();
  for (const type of ['vented', 'sealed', 'vented']) {
    await page.locator('#np-box-type').selectOption(type);
    await settled();
  }
  const seen = z.array(z.string()).parse(await page.evaluate((): unknown => Reflect.get(window, 'columnsSeen')));
  const defaultColumn = `${PhoneRowColumns.STANDARD.labelPx}px`;
  expect(seen.length, 'the column was measured for step 3').toBeGreaterThan(0);
  expect(seen.filter(value => value === defaultColumn), `columns seen: ${seen.join(', ')}`).toEqual([]);
});
