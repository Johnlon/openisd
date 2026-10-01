/**
 * NumInput's up/down stepper (John, 2026-10-01: mobile's numeric rows have "lots of empty
 * space"; wants touch step buttons next to the value, Box/Enclosure/Signal/Advanced tabs — side
 * by side, 2026-10-02: "wide beside, not above" — value, then ▲▼, then the unit).
 *
 * The buttons drive the native input's own `stepUp()`/`stepDown()` against the SAME `step`/
 * `min`/`max` the keyboard arrows already use (NumInput.vue's `stepAttr`), then dispatch the
 * same `input` event `onKeydown`'s ArrowUp/ArrowDown path produces — there is no second
 * rounding/step implementation to prove separately, so this spec proves EQUIVALENCE (a button
 * click and an arrow-key press move the value by the identical amount), not a step formula of
 * its own.
 *
 * Run at phone width (412×900), not just the forced mobile skin — the touch-target assertion
 * needs the real narrow layout, not a wide window with the mobile skin switched on.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem('openisd_view', JSON.stringify({ ui: { splashSeen: true, skinOverride: 'mobile' } }));
  });
  await page.goto('/');
  await openAMobileProject(page);
});

function fieldRow(page: import('playwright').Page, label: string) {
  return page.locator('.mob-field-row', { has: page.locator('.mob-field-label', { hasText: label }) });
}

test('a step button click moves the value by the exact same amount as an ArrowUp keypress', async ({ page }) => {
  await page.locator('.mob-tab', { hasText: 'Signal' }).click();
  const row = fieldRow(page, 'Series resistance');
  const input = row.locator('input');
  const upBtn = row.locator('.num-stepper-btn').first(); // [▲, ▼] order — ▲ is first

  const before = Number(await input.inputValue());
  await upBtn.click();
  const afterClick = Number(await input.inputValue());
  const clickDelta = afterClick - before;
  expect(clickDelta).toBeGreaterThan(0);

  await input.focus();
  await input.press('ArrowUp');
  const afterArrow = Number(await input.inputValue());
  const arrowDelta = afterArrow - afterClick;

  expect(arrowDelta).toBeCloseTo(clickDelta, 9);
});

test('the down button undoes the up button exactly — same step size, opposite direction', async ({ page }) => {
  await page.locator('.mob-tab', { hasText: 'Signal' }).click();
  const row = fieldRow(page, 'Series resistance');
  const input = row.locator('input');
  const [upBtn, downBtn] = await row.locator('.num-stepper-btn').all(); // [▲, ▼] order

  const start = Number(await input.inputValue());
  await upBtn.click();
  const up = Number(await input.inputValue());
  expect(up).toBeGreaterThan(start);

  await downBtn.click();
  const down = Number(await input.inputValue());
  expect(down).toBeCloseTo(start, 9);
});

test('the stepper buttons meet a touch-sized minimum at phone width', async ({ page }) => {
  await page.locator('.mob-tab', { hasText: 'Box' }).click();
  const btn = fieldRow(page, 'Volume').locator('.num-stepper-btn').first();
  await expect(btn).toBeVisible();
  const box = await btn.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(28);
  expect(box!.height).toBeGreaterThanOrEqual(18);
});

// Not covered here: `System input power` suppresses the stepper when `powerLocked` (the driver
// has no usable Re, so P = V²/Re cannot be stated) — verified correct by inspection
// (`showStepper = computed(() => props.stepper && !isReadonly.value)`, NumInput.vue), but that
// state isn't reachable through the Driver Editor to drive an end-to-end check: Re is
// `:mandatory="true"` there and the editor silently keeps the last value rather than accepting
// a clear. It would need a driver fixture that never had a usable Re to begin with.

test('holding the button repeats the step, not just one click\'s worth of movement', async ({ page }) => {
  await page.locator('.mob-tab', { hasText: 'Signal' }).click();
  const row = fieldRow(page, 'Series resistance');
  const input = row.locator('input');
  const upBtn = row.locator('.num-stepper-btn').first(); // [▲, ▼] order — ▲ is first

  // One plain click: the baseline, a single step's worth of movement.
  const before = Number(await input.inputValue());
  await upBtn.click();
  const afterOneClick = Number(await input.inputValue());
  const oneStep = afterOneClick - before;
  expect(oneStep).toBeGreaterThan(0);

  // Hold well past the 450ms initial delay plus a few 80ms repeats (NumInput.vue's
  // startRepeat) — the total movement from holding must clearly exceed one step, proving the
  // repeat actually fired more than once rather than just the initial press.
  const box = await upBtn.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  // Poll (not a fixed sleep) until the hold has clearly moved the value past one step's worth —
  // proof the repeat fired again, not just the initial press — within a generous budget past
  // the 450ms initial delay plus a few 80ms repeats (NumInput.vue's startRepeat).
  await expect.poll(async () => Number(await input.inputValue()), { timeout: 2000 })
    .toBeGreaterThan(afterOneClick + oneStep);
  await page.mouse.up();
});
