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
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 900 });
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
});

function fieldRow(page: import('playwright').Page, label: string) {
  return mobileFieldRow(page, label);
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

test('a long hold on ▲ takes 10 % steps and lands on a round value when released', async ({ page }) => {
  await page.locator('.mob-tab', { hasText: 'Signal' }).click();
  const row = fieldRow(page, 'Series resistance');
  const input = row.locator('input');
  const upBtn = row.locator('.num-stepper-btn').first();

  const start = Number(await input.inputValue());
  const box = await upBtn.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(2200);
  await page.mouse.up();

  const end = Number(await input.inputValue());
  expect(end).toBeGreaterThan(start * 1.3);   // fine steps alone (~1 % each) could not get this far
  expect(Number(end.toPrecision(2))).toBe(end);   // two significant digits at most
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

// John, 2026-10-02: focus on the tapped button, never the input (it pops the phone keyboard).
test('pressing a step button focuses the button, not the field', async ({ page }) => {
  await page.locator('.mob-tab', { hasText: 'Box' }).click();
  const other = fieldRow(page, 'Volume').locator('input');
  await other.focus();
  await page.locator('.mob-tab', { hasText: 'Signal' }).click();
  const row = fieldRow(page, 'Series resistance');
  const input = row.locator('input');
  const btn = row.locator('.num-stepper-btn').first();
  await btn.click();
  await expect(btn).toBeFocused();
  await expect(input).not.toBeFocused();
});

// John, 2026-10-02 (screenshot): a row with no unit (Qms) had its ▲▼ further right than its
// neighbours. Every stepper lines up whether or not its row has a unit.
test('a unitless row\'s step buttons line up with a row that has a unit', async ({ page }) => {
  await page.evaluate(async (p) => {
    type AppState = typeof import('../../src/logic/appState.js');
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m;
    }
    const m: unknown = await import(/* @vite-ignore */ p);
    if (!isAppState(m)) throw new Error('appState module shape mismatch');
    m.requireFocusedProject().box.boxType.set('box-passive-radiator');
  }, '/src/logic/appState.ts');
  await page.locator('.mob-tab', { hasText: 'Passive Radiator' }).click();
  const withUnit = await fieldRow(page, 'Vas').locator('.num-stepper').boundingBox();
  const unitless = await fieldRow(page, 'Qms').locator('.num-stepper').boundingBox();
  expect(withUnit).not.toBeNull();
  expect(unitless).not.toBeNull();
  expect(Math.abs(unitless!.x + unitless!.width - (withUnit!.x + withUnit!.width))).toBeLessThan(1);
});

// John, 2026-10-02: "make the mobile fields look like inputs when they are input".
test('an editable value is drawn as an input box; a read-only one is not', async ({ page }) => {
  await page.locator('.mob-tab', { hasText: 'Signal' }).click();
  const input = fieldRow(page, 'Series resistance').locator('input');
  const style = await input.evaluate(el => {
    const s = getComputedStyle(el);
    return { border: s.borderTopStyle, width: parseFloat(s.borderTopWidth), bg: s.backgroundColor };
  });
  expect(style.border).toBe('solid');
  expect(style.width).toBeGreaterThan(0);
  expect(style.bg).not.toBe('rgba(0, 0, 0, 0)');

  // A calculated read-only value renders through NumReadout (a plain span), not NumInput with a
  // readonly attribute — asserted directly (no `if`, playwright/no-conditional-expect): there is
  // no <input> at all for it to look like one.
  await page.locator('.mob-tab', { hasText: 'Box' }).click();
  await page.locator('#mob-box-type').selectOption('sealed');
  await expect(fieldRow(page, 'Fsc').locator('input')).toHaveCount(0);
});

// Field diagnostics 2026-10-02: a stepper tapped on a field holding 0 threw InvalidStateError
// ("does not have an allowed value step") because the step was 'any' for a non-positive value.
test('a step button on a field holding zero steps up instead of throwing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.locator('.mob-tab', { hasText: 'Signal' }).click();
  const row = fieldRow(page, 'Series resistance');
  const input = row.locator('input');
  await input.fill('0');
  await input.blur();
  await row.locator('.num-stepper-btn').first().click();
  expect(Number(await input.inputValue())).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
