import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {expect, test} from '../fixtures.js';

const html = readFileSync(new URL('../../../../docs/design/field-use-cases.html', import.meta.url), 'utf8');
let behaviour = '';

test.use({isMobile: true, hasTouch: true});

test.beforeAll(async () => {
  const bundle = await build({entryPoints: [new URL('../../../../docs/design/field-use-cases-behaviour.ts', import.meta.url).pathname], bundle: true, format: 'iife', globalName: 'OpenISDFieldBehaviour', write: false});
  behaviour = bundle.outputFiles[0]!.text;
});

test.beforeEach(async ({page}) => {
  await page.setViewportSize({width: 374, height: 400});
  await page.route('**/__field-use-cases/', route => route.fulfill({contentType: 'text/html', body: html}));
  await page.route('**/__field-use-cases/field-behaviour.js?*', route => route.fulfill({contentType: 'text/javascript', body: behaviour}));
  await page.route('**/board/thread.js', route => route.fulfill({contentType: 'text/javascript', body: ''}));
  await page.goto('/__field-use-cases/');
});

const spinnerCases = ['inverse', 'underline', 'blink', 'solid', 'outline', 'gain', 'mass', 'power', 'qms', 'editable unit', 'DQ', 'model', 'DQ and model', 'no units'];
for (const [index, name] of spinnerCases.entries()) {
  test(`the ${name} spinner stays under the finger even if native blur precedes its press`, async ({page}) => {
    await page.emulateMedia({reducedMotion: 'reduce'});
    const rows = page.locator('.field-row').filter({has: page.locator('.steppers')});
    await expect(rows).toHaveCount(spinnerCases.length);
    const row = rows.nth(index), input = row.locator('input.value');
    const up = row.getByRole('button', {name: 'Increase', exact: true});
    await page.evaluate(() => { const spacer = document.createElement('div'); spacer.style.height = '705px'; document.body.prepend(spacer); });
    await input.focus();
    await input.evaluate(el => el.scrollIntoView({block: 'center'}));
    const before = await input.evaluate(el => el.getBoundingClientRect().top);
    // Android may blur the input before the spinner's pointer handler gets the event.
    await input.blur();
    await up.tap();
    await page.setViewportSize({width: 374, height: 705});
    await page.evaluate(() => window.scrollBy(0, -150));
    await expect.poll(() => input.evaluate(el => el.getBoundingClientRect().top)).toBe(before);
  });
}

test('only inverse video is decided and every other cursor is explicitly discarded', async ({page}) => {
  await expect(page.locator('[data-choice="decided"]')).toHaveAttribute('data-spin-option', 'inverse');
  await expect(page.locator('[data-choice="discarded"]')).toHaveCount(4);
  await expect(page.locator('[data-spin-option]').first()).toHaveAttribute('data-spin-option', 'inverse');
});

test('a native caret after the final digit moves the inverse marker and spins the final place', async ({page}) => {
  const row = page.locator('[data-spin-option="inverse"]'), input = row.locator('input');
  await input.fill('123.4500');
  await input.press('ArrowLeft');
  await input.press('End');
  await expect(row.locator('.digit-guide > span').nth(7)).toHaveClass('selected');
  expect(await input.evaluate(el => el instanceof HTMLInputElement && el.selectionStart === 8 && el.selectionEnd === 8)).toBe(true);
  await row.getByRole('button', {name: 'Increase', exact: true}).tap();
  await expect(input).toHaveValue('123.4501');
  await row.getByRole('button', {name: 'Decrease', exact: true}).tap();
  await expect(input).toHaveValue('123.4500');
});
