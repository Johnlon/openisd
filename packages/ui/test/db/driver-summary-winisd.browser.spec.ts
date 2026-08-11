import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures.js';

// ui-todo.md "Single click opens a driver summary, not the editor" — for the WinISD picker
// (DriverBrowserWinisd.vue), which until now selected straight off the row click. The Modern
// picker has always previewed first; this brings the WinISD one to the same behaviour.
//
// STATE_MODEL.md rule 1 governs what a selection DOES, and it changed under this spec: a
// choice now EMBEDS the driver in the project and closes the picker — no editor in the way.
// So the summary is a reading step in front of that embed, and Use is the moment of choice.
// Editing is a separate act afterwards, from the Driver panel.
//
// The driver is seeded into My Drivers rather than taken from the bundled catalogue, so the
// spec does not depend on how many records the bundler currently ships.

const PICKED = 'Summary Fixture Driver';
const EDITOR = '.de-modal';
const SUMMARY = '.preview';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('openisd.state', JSON.stringify({ ui: { skin: 'original' } }));
  });
  await page.goto('/');
  await page.evaluate(name => {
    localStorage.setItem('openisd_my_drivers', JSON.stringify([{
      name, brand: 'Summary', model: 'Fixture',
      Fs: 41, Qts: 0.35, Qes: 0.38, Qms: 4.5, Vas: 0.028, Sd: 0.0132,
      Re: 5.4, Le: 0.5e-3, Xmax: 0.0055, Pe: 70, Z: 8, _savedAt: 1,
    }]));
  }, PICKED);
  await page.goto('/');
});

// "The design is untouched" is asserted against the DESIGN, not a shell widget: the driver
// carried in the persisted state. The name element differs per shell, and reading one of
// those would tie this spec to a layout it is not about.
async function currentDriver(page: Page): Promise<string> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('openisd.state');
    return raw ? JSON.stringify(JSON.parse(raw).driver ?? null) : 'no-state';
  });
}

async function openSummary(page: Page): Promise<void> {
  await page.locator('[title*="librar" i]').first().click();
  await page.locator('.my-ditem b', { hasText: PICKED }).click();
  await expect(page.locator(SUMMARY), 'the row click did not open the summary').toBeVisible();
}

test('a single click opens the summary and does NOT open the editor', async ({ page }) => {
  await openSummary(page);
  await expect(page.locator(EDITOR), 'the row click went straight into the driver editor')
    .toBeHidden();
});

test('the summary shows what we know about the driver', async ({ page }) => {
  await openSummary(page);
  // Its identity, and real values off the record — not an empty shell.
  await expect(page.locator('.wb-modal h2')).toContainText(PICKED);
  await expect(page.locator(`${SUMMARY} .spec-row`).first()).toBeVisible();
  await expect(page.locator(SUMMARY)).toContainText('Fs');
  await expect(page.locator(SUMMARY)).toContainText('41');
});

test('Cancel returns to the list with nothing changed', async ({ page }) => {
  const before = await currentDriver(page);
  await openSummary(page);

  await page.locator(`${SUMMARY} .cancel-btn`).click();

  await expect(page.locator(SUMMARY), 'Cancel did not close the summary').toBeHidden();
  await expect(page.locator('.dlist'), 'Cancel did not return to the driver list').toBeVisible();
  await expect(page.locator(EDITOR), 'Cancel opened the editor').toBeHidden();
  expect(await currentDriver(page),
    'Cancel changed the design').toBe(before);
});

test('Use embeds the driver in the project and closes the picker', async ({ page }) => {
  const before = await currentDriver(page);
  await openSummary(page);

  await page.locator(`${SUMMARY} .use-btn`).click();

  // STATE_MODEL.md rule 1: the choice IS the commit. No editor stands in the way, and the
  // picker gets out of the way too. `.wb-modal` is this picker's own class — the broader
  // `.modal:not(.de-modal)` matches two elements in the Original shell.
  await expect(page.locator(EDITOR), 'Use opened the editor — choosing is not editing')
    .toBeHidden();
  await expect(page.locator('.wb-modal'), 'the picker stayed open after the driver was chosen')
    .toBeHidden();
  expect(await currentDriver(page), 'Use did not embed the chosen driver in the project')
    .not.toBe(before);
});

// Use is the primary action and Cancel is the way out; they must not look like the same
// button. This is the third time a rule in this component has been silently beaten by the
// blanket `.wb-modal button` rule (see bugs/_archive for the chip case), and every previous
// time the class was applied correctly while the paint was not — so this asserts the PAINT.
test('Use is styled as the primary action, distinct from Cancel', async ({ page }) => {
  await openSummary(page);

  const paint = (sel: string) => page.locator(sel).evaluate((el) => {
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, fg: cs.color };
  });

  await page.mouse.move(0, 0);
  const use = await paint(`${SUMMARY} .use-btn`);
  const cancel = await paint(`${SUMMARY} .cancel-btn`);

  expect(use.bg, 'Use and Cancel have the same fill — Use is not reading as the primary action')
    .not.toBe(cancel.bg);
});

test('the summary carries a favourite toggle, and the star it sets shows on the row', async ({ page }) => {
  await openSummary(page);

  const star = page.locator(`${SUMMARY} .fav-btn`);
  await expect(star, 'the summary has no favourite toggle').toHaveCount(1);
  await expect(star, 'the summary star started out already on').not.toHaveClass(/on/);
  await star.click();
  await expect(star, 'the summary star did not light up').toHaveClass(/on/);

  await page.locator(`${SUMMARY} .cancel-btn`).click();
  await expect(page.locator('.my-ditem').filter({ hasText: PICKED }).locator('.fav-btn'),
    'starring in the summary did not mark the same driver in the list').toHaveClass(/on/);
});
