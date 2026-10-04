import {expect, openAProject, test} from '../fixtures.js';
import type {Locator, Page} from '@playwright/test';
import {fillAndBlur} from '../fixtures/numField.js';

// Decimal places shown in a numeric-input string ("6.10" → 2, "55" → 0, "" → 0).
function decimalsOf(s: string): number {
  const m = s.trim().match(/^-?\d*\.(\d+)$/);
  return m ? m[1].length : 0;
}

// Class-level spinner invariant: a spinner step (Arrow Up/Down) must never GAIN decimal
// places over what the field shows at rest. Each field has a fixed display precision; a
// step that turns "6.00" into "8.94924452476786" is the bug. Asserted over every
// input[type=number] so no field (or second spinner mechanism) can regress unnoticed.
// Returns 1 if the field was actually spun-and-checked, 0 if skipped (hidden / non-numeric).
async function assertSpinnerHoldsDp(input: Locator, label: string): Promise<number> {
  if (!(await input.isVisible()) || !(await input.isEditable())) return 0;
  await input.scrollIntoViewIfNeeded();
  const fieldName = await input.evaluate((el) => el.closest('.field')?.querySelector('label')?.textContent?.trim() || el.getAttribute('aria-label') || '?');
  label = `${label} [${fieldName}]`;
  const before = (await input.inputValue()).trim();
  if (!/^-?\d+(\.\d+)?$/.test(before)) return 0; // skip empty / non-numeric fields
  const dpBefore = decimalsOf(before);
  await input.focus();
  // A number input whose current step attr has no ALLOWED value step (dynamic stepAttr — a power
  // of ten off the value's magnitude, clamped at the field precision → 'any' near zero, see
  // NumInput.vue) throws InvalidStateError from stepUp()/stepDown(). Such a field cannot gain
  // decimals by native stepping, so there is nothing to check: run the whole up/down sequence
  // as one probe and skip the field if the DOM rejects any step.
  const spun = await input.evaluate(el => {
    if (!(el instanceof HTMLInputElement)) return null;
    const step = (goingUp: boolean, n: number) => {
      for (let i = 0; i < n; i++) {
        if (goingUp) el.stepUp(); else el.stepDown();
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };
    try {
      step(true, 6);
      const up = el.value;
      step(false, 12);
      return { up, down: el.value };
    } catch (e) {
      if (e instanceof DOMException && e.name === 'InvalidStateError') return null;
      throw e;
    }
  });
  if (!spun) return 0;
  expect(decimalsOf(spun.up), `${label}: gained decimals spinning UP  "${before}" → "${spun.up}"`).toBeLessThanOrEqual(dpBefore);
  expect(decimalsOf(spun.down), `${label}: gained decimals spinning DOWN "${before}" → "${spun.down}"`).toBeLessThanOrEqual(dpBefore);
  return 1;
}

// Sweep every visible numeric spinner on the currently-active project tab; returns the count checked.
async function sweepActiveTab(page: Page, context: string): Promise<number> {
  const inputs = await page.locator('.original-root .tab-section.active input[type="number"]').all();
  let n = 0;
  for (let i = 0; i < inputs.length; i++) n += await assertSpinnerHoldsDp(inputs[i], `${context} #${i}`);
  return n;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
});

// ---------------------------------------------------------------------------------------------
// Reading the MODEL, not the DOM. These go through appState.requireFocusedProject() and the
// project's live Field surface (packages/design/domain/openisdDomain.ts): a SimpleField answers to
// .value/.set(), a Field to .value/.set(). The old helpers these replace (boxVolume_m3(),
// inputPower_W(), filters(), engineDriver()...) were deleted from the domain, so every call
// site below timed out on "not a function" instead of failing on an assertion.
// ---------------------------------------------------------------------------------------------
const APP_STATE = '/src/logic/appState.ts';

/** The `appState.ts` module shape every dynamic-import evaluate() call below narrows to — a
 *  type-only alias, erased at compile time, so it is safe to name from inside a serialized
 *  browser callback without crossing the closure boundary (only VALUES can't cross it). */
type AppState = typeof import('../../src/logic/appState.js');
type PresentationState = typeof import('../../src/logic/presentationState.js');

/** The active box's volume in m³, whichever box type is selected — mirrors boxFields.ts. */
const readVb = (page: Page) =>
  page.evaluate(async (modPath): Promise<number> => {
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m && typeof m.requireFocusedProject === 'function';
    }
    const mod: unknown = await import(/* @vite-ignore */ modPath);
    if (!isAppState(mod)) throw new Error('appState module shape mismatch');
    const box = mod.requireFocusedProject().box;
    switch (box.boxType.value) {
      case 'sealed': return box.sealed.volume_m3.value;
      case 'vented': return box.vented.volume_m3.value;
      case 'bandpass4': return box.bandpass4.chambers.rear.volume_m3.value;
      case 'bandpass6': return box.bandpass6.chambers.rear.volume_m3.value;
      case 'abc': return box.abc.chambers.rear.volume_m3.value;
      case 'box-passive-radiator': return box.passiveRadiator.volume_m3.value;
    }
  }, APP_STATE);

const readFilterCount = (page: Page) =>
  page.evaluate(async (modPath): Promise<number> => {
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m && typeof m.requireFocusedProject === 'function';
    }
    const mod: unknown = await import(/* @vite-ignore */ modPath);
    if (!isAppState(mod)) throw new Error('appState module shape mismatch');
    return mod.requireFocusedProject().filters.value.length;
  }, APP_STATE);

/** Drive power in W — the one stored drive fact; voltage is always derived from it (ruling T5). */
const readPowerDrive_W = (page: Page) =>
  page.evaluate(async (modPath): Promise<number> => {
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m && typeof m.requireFocusedProject === 'function';
    }
    const mod: unknown = await import(/* @vite-ignore */ modPath);
    if (!isAppState(mod)) throw new Error('appState module shape mismatch');
    const value = mod.requireFocusedProject().powerDrive_W.value;
    if (value === null) throw new Error('powerDrive_W has no value');
    return value;
  }, APP_STATE);

const readAddedMass_kg = (page: Page) =>
  page.evaluate(async (modPath): Promise<number> => {
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m && typeof m.requireFocusedProject === 'function';
    }
    const mod: unknown = await import(/* @vite-ignore */ modPath);
    if (!isAppState(mod)) throw new Error('appState module shape mismatch');
    return mod.requireFocusedProject().driverAddedMass_kg.value;
  }, APP_STATE);

/** One driver spec field's live value, read via appState.focusedProject() (nullable — the Tune
 *  panel's what-if edits run around an open/close cycle where the project briefly loses focus). */
function readDriverSpecField(page: Page, field: 'Fs_hz' | 'Mms_kg'): Promise<number> {
  return page.evaluate(async (f): Promise<number> => {
    const modPath = '/src/logic/appState.ts';
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'focusedProject' in m && typeof m.focusedProject === 'function';
    }
    const mod: unknown = await import(/* @vite-ignore */ modPath);
    if (!isAppState(mod)) throw new Error('appState module shape mismatch');
    const project = mod.focusedProject();
    if (!project) throw new Error('expected a focused project');
    const value = project.driver.specs[f].value;
    if (value === null) throw new Error(`driver.specs.${f} has no value`);
    return value;
  }, field);
}


test('the Filters tab quick-adds real filter types and drives the store', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Filters' }).click();
  const panel = page.locator('.content-panel');
  // Every WinISD Filter Editor type (8) plus the two OpenISD-only shelves.
  await expect(panel.locator('.filters-quickadd .action-btn')).toHaveCount(10);

  await panel.locator('.action-btn', { hasText: '+ HP' }).click();
  await expect(panel.locator('.filters-list .filter-row-inline')).toHaveCount(1);
  await expect(panel.locator('.filter-type-badge')).toContainText('HP');
  const n = await readFilterCount(page);
  expect(n).toBe(1);

  await panel.locator('.filter-del').click();
  await expect(panel.locator('.filters-list .filter-row-inline')).toHaveCount(0);
});

test('v-expo-step fields keep clean decimals while spinning (grid-aligned step)', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Advanced' }).click();
  const hum = page.locator('.tab-section.active .field', { hasText: 'Relative humidity' }).locator('input');
  await hum.click();
  await hum.fill('50');
  for (let i = 0; i < 4; i++) await hum.press('ArrowUp'); // compounding steps
  const val = await hum.inputValue();
  expect(val).toMatch(/^\d+(\.\d{1,2})?$/); // clean grid value, never a long compounding float
});

test('NumInput spinner keeps fixed decimal places (no compounding float precision)', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  const vol = page.locator('.tab-section.active .field', { hasText: 'Volume' }).locator('input').first();
  await vol.click();
  await vol.fill('6');
  for (let i = 0; i < 3; i++) await vol.press('ArrowUp'); // native spinner steps, compounding
  const val = await vol.inputValue();
  expect(val).toMatch(/^\d+(\.\d{1,2})?$/); // at most 2 dp — never a long compounding float
});

test('NumInput dp is screen-formatting only — the model keeps FULL precision (not truncated to dp)', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  const vol = page.locator('.tab-section.active .field', { hasText: 'Volume' }).locator('input').first();
  await vol.click();
  await fillAndBlur(vol, '6.123456'); // more decimals than the field's 2 dp
  await expect(vol).toHaveValue('6.12'); // DISPLAY is formatted to 2 dp
  const vb = await readVb(page); // stored in m³ (display L ÷ 1000)
  expect(vb).toBeCloseTo(0.006123456, 9); // MODEL retains full precision — never the 2-dp "0.00612"
});

test('class-level: NO Original-skin spinner gains decimal places while spinning (all fields, all box types)', async ({ page }) => {
  test.setTimeout(120_000); // exhaustive sweep: 4 box types × every tab × 18 key-presses per field
  // Box tab across every box type — exposes the type-specific spinners (vents, PR, chambers)
  // as well as the shared Volume/Signal/Advanced fields. Covers NumInput and v-expo-step at once.
  let checked = 0;
  for (const boxType of ['sealed', 'vented', 'box-passive-radiator', 'bandpass4'] as const) {
    await page.locator('.project-nav li', { hasText: 'Box' }).click();
    await page.locator('select#og-box-type').selectOption(boxType);
    // Sweep every project tab that exists for this box type (the tab set changes per type).
    const tabCount = await page.locator('.project-nav li').count();
    for (let t = 0; t < tabCount; t++) {
      const li = page.locator('.project-nav li').nth(t);
      const name = ((await li.textContent()) || `tab${t}`).trim();
      await li.click();
      checked += await sweepActiveTab(page, `${boxType}/${name}`);
    }
  }
  // The docked Tune panel (v-expo-step T/S fields) — the highest-risk fractional-value spinners.
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.save-rail .tune-btn').click();
  const tuneInputs = await page.locator('.tune-panel input[type="number"]').all();
  for (let i = 0; i < tuneInputs.length; i++) checked += await assertSpinnerHoldsDp(tuneInputs[i], `Tune #${i}`);

  // Guard against a selector that silently matches nothing (which would make the sweep a no-op
  // and pass vacuously). The Original skin has well over a dozen numeric spinners across types.
  expect(checked, 'class-level sweep visited too few spinners — selector likely drifted').toBeGreaterThan(12);
});

test('field constraints: negative/out-of-range entry is rejected or clamped everywhere (schema-enforced)', async ({ page }) => {
  // 1. NumInput (registry-bound): typing a negative into Box Volume must flag it and NOT
  //    reach the model; blur reverts to the last valid value.
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  const vb = page.locator('.tab-section.active .field', { hasText: 'Volume' }).locator('input').first();
  const before = await vb.inputValue();
  await vb.fill('-5');
  await expect(vb).toHaveClass(/inp-bad/); // rejected, red-flagged
  await vb.blur();
  await expect(vb).toHaveValue(before);    // model never took the negative
  // 2. Air fields are DIFFERENT by design (human ruling 2026-09-17): they accept the
  //    out-of-range entry and signal it with a dq-flag + tooltip rather than clamping
  //    (OriginalShell.vue :allow-out-of-range="true" — the app's chosen contract).
  await page.locator('.project-nav li', { hasText: 'Advanced' }).click();
  const rh = page.locator('.tab-section.active .field', { hasText: 'Relative humidity' }).locator('input');
  await rh.fill('-20');
  await expect(rh).toHaveClass(/dq-flag/);           // flagged, not clamped
  await expect(rh).toHaveAttribute('title', /outside the sane range/);
  await rh.fill('250');
  await expect(rh).toHaveClass(/dq-flag/);           // ceiling too, not just the floor
  // 3. Tune panel (scaled registry bounds): Fs typed negative clamps to the 1 Hz floor.
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.save-rail .tune-btn').click();
  const fs = page.locator('.tune-panel .tune-fld', { hasText: 'Fs' }).first().locator('input');
  await fs.fill('-40');
  await expect(fs).toHaveValue('1');
  await page.locator('.tune-panel .close-btn').click();
});

test('Original toolbar: Share link (Export menu) writes the design into the address bar', async ({ page }) => {
  page.on('dialog', (d) => d.dismiss().catch(() => {})); // if clipboard is blocked, shareLink falls back to prompt()
  await page.locator('#btnExportMenu').click();
  await page.locator('#btnShare').click();
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('s=');
});

test('a pinned graph cursor does NOT survive the share link (QO168: cursor is session-only, never saved)', async ({ page }) => {
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  const defaultHz = (await page.locator('.cursor-readout .ro-hz').textContent())!.trim();

  // Pin the cursor: hover mid-chart then click (hover sets cursorF, click locks it as pinnedF).
  const chart = page.locator('.graph-wrap .gpanel canvas').first();
  const box = (await chart.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  const hz = (await page.locator('.cursor-readout .ro-hz').textContent())!.trim();
  expect(hz).not.toContain('—'); // a real pinned frequency, e.g. "43.30 Hz"

  await page.locator('#btnExportMenu').click();
  await page.locator('#btnShare').click();
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('s=');
  const url = await page.evaluate(() => location.href);

  // Open the link cold — no local state, only the URL carries the design. Shares write the
  // hash into the sender's own address bar, so goto(url) alone would be a same-URL no-op
  // navigation that keeps all in-memory state; bounce through about:blank to force a real load.
  await page.evaluate(() => localStorage.clear());
  await page.goto('about:blank');
  await page.goto(url);
  await expect(page.locator('.original-root')).toBeVisible();
  // QO168: cursorF/pinnedF/cursorLocked/dragRange are plain in-memory instance state, excluded
  // from every saved record (not .owpr, not autosave, not a share link) — the recipient sees the
  // sender's design but starts with a fresh, unpinned cursor.
  await expect(page.locator('.cursor-readout .ro-hz')).toHaveText(defaultHz);
});

test('a dragged frequency band selection does NOT survive the share link (QO168: cursor is session-only, never saved)', async ({ page }) => {
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  // Band-select by dragging across the plot area.
  const chart = page.locator('.graph-wrap .gpanel canvas').first();
  const box = (await chart.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.5, { steps: 8 });
  await page.mouse.up();
  const readout = (await page.locator('.gread').textContent())!.trim();
  expect(readout).toMatch(/Hz.*–.*Hz/); // e.g. "31.6 Hz – 100 Hz  Δ …"

  await page.locator('#btnExportMenu').click();
  await page.locator('#btnShare').click();
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('s=');
  const url = await page.evaluate(() => location.href);

  // Cold open (about:blank bounce — see the pinned-cursor test above for why).
  await page.evaluate(() => localStorage.clear());
  await page.goto('about:blank');
  await page.goto(url);
  await expect(page.locator('.original-root')).toBeVisible();
  // QO168: dragRange is one of the four cursor fields — never part of the saved record, so the
  // recipient's chart opens with no band selected.
  await expect(page.locator('.gread')).toHaveText('');
});

test('Driver Editor decimals come from the registry (Vas 2 dp, Sd 1 dp)', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.driver-id-row').getByRole('button', { name: 'Edit' }).click();
  const modal = page.locator('.overlay.on');
  await expect(modal).toContainText("Edit Project's Driver");
  await modal.locator('.de-tab', { hasText: 'Parameters' }).first().click(); // Vas/Sd live on the Parameters tab
  const vas = modal.locator('.de-fld', { hasText: 'Vas' }).locator('input').first();
  await fillAndBlur(vas, '20');
  await expect(vas).toHaveValue('20.00'); // registry Vas = 2 dp (was a 3-dp literal)
  const sd = modal.locator('.de-fld', { hasText: 'Sd' }).locator('input').first();
  await fillAndBlur(sd, '130');
  await expect(sd).toHaveValue('130.00'); // registry Sd = 2 dp (was a 4-dp literal)
});

// ---- Per-field display-unit conversion (fields/units.ts + <UnitToggle>) ------------
// The store ALWAYS holds SI; clicking a field's unit label must rescale only the shown
// value (and convert typed input back), never the stored model. This is the real
// conversion that replaced the old decorative cycleUnit (which rotated the label alone).
const readVbToken = (page: Page) =>
  page.evaluate(async (): Promise<string | undefined> => {
    const modPath = '/src/logic/presentationState.ts';
    function isPresentationState(m: unknown): m is PresentationState {
      return typeof m === 'object' && m !== null && 'presentationState' in m;
    }
    const mod: unknown = await import(/* @vite-ignore */ modPath);
    if (!isPresentationState(mod)) throw new Error('presentationState module shape mismatch');
    return mod.presentationState.ui.unitTokens?.Vb;
  });

test('clicking an entered field\'s unit label rescales the DISPLAY and keeps the model SI', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  const field = page.locator('.tab-section.active .field', { hasText: 'Volume' }).first();
  const vol = field.locator('input').first();
  const label = field.locator('.unit-cyc');

  await vol.click();
  await fillAndBlur(vol, '6');            // 6 L
  await expect(vol).toHaveValue('6.00');
  await expect(label).toHaveText('L');
  expect(await readVb(page)).toBeCloseTo(0.006, 9);   // stored in SI m³

  await label.click();           // L → cu ft
  await expect(label).toHaveText('cu ft');
  await expect(vol).toHaveValue('0.212');             // 0.006 m³ × 35.3147, 3 dp
  expect(await readVb(page)).toBeCloseTo(0.006, 9);   // MODEL unchanged by a unit switch
  expect(await readVbToken(page)).toBe('cuft');       // token persisted (survives refresh)

  await vol.click();
  await fillAndBlur(vol, '0.3');         // now typing in cu ft
  expect(await readVb(page)).toBeCloseTo(0.3 / 35.3147, 6); // converted back to SI
});

test('a calculated readout also rescales when its unit is rotated (Hz → kHz)', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  await page.locator('select#og-box-type').selectOption('vented');
  await page.evaluate(async (modPath): Promise<void> => {
    function isAppState(m: unknown): m is AppState {
      return typeof m === 'object' && m !== null && 'requireFocusedProject' in m && typeof m.requireFocusedProject === 'function';
    }
    const mod: unknown = await import(/* @vite-ignore */ modPath);
    if (!isAppState(mod)) throw new Error('appState module shape mismatch');
    const p = mod.requireFocusedProject();
    p.box.vented.volume_m3.set(0.06);
    p.box.vented.tuning_goal_hz.set(40);
    p.box.vented.vent.diameter_m.set(0.1);
  }, APP_STATE);
  await page.locator('.project-nav li').nth(2).click();               // dynamic enclosure/Vents tab
  const field = page.locator('.tab-section.active .field', { hasText: '1st port resonance' });
  const val = field.locator('input');
  const label = field.locator('.unit-cyc');

  await expect(label).toHaveText('Hz');
  const hz = parseFloat(await val.inputValue());
  expect(hz).toBeGreaterThan(0);

  await label.click();           // Hz → kHz
  await expect(label).toHaveText('kHz');
  const khz = parseFloat(await val.inputValue());
  expect(khz).toBeCloseTo(hz / 1000, 3);                             // same SI value, finer unit (display-rounded to 2dp)
});

test('Added mass to cone: clicking the unit converts g → kg; the model stays SI (kg)', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  const field = page.locator('.field', { hasText: 'Added mass to cone' });
  const amc = field.locator('input');
  const unit = field.locator('.unit');

  await amc.fill('100');
  await amc.dispatchEvent('input');
  await amc.blur();
  await expect(unit).toHaveText('g');
  const readMadd = () => readAddedMass_kg(page);
  expect(await readMadd()).toBeCloseTo(0.1, 6);   // 100 g entered → 0.1 kg in the model

  await unit.click();                              // g → kg
  await expect(unit).toHaveText('kg');
  expect(parseFloat(await amc.inputValue())).toBeCloseTo(0.1, 6); // now shown in kg
  expect(await readMadd()).toBeCloseTo(0.1, 6);    // MODEL unchanged by the display-unit switch
});

test('Advanced Temperature: K → °C converts via OFFSET; the model stays in kelvin', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Advanced' }).click();
  const tempField = page.locator('.tab-section.active .field', { hasText: 'Temperature' });
  const temp = tempField.locator('input');
  const unit = tempField.locator('.unit-cyc');
  const sv = page.locator('.tab-section.active .field', { hasText: 'Sound velocity' }).locator('input');

  await expect(unit).toHaveText('K');
  await expect(temp).toHaveValue('293.15');
  const svBefore = await sv.inputValue();          // depends on temperature IN KELVIN

  await unit.click();                              // K → °C (affine: −273.15, not a factor)
  await expect(unit).toHaveText('°C');
  await expect(temp).toHaveValue('20.00');         // 293.15 K − 273.15 = 20.00 °C
  await expect(sv).toHaveValue(svBefore);          // unchanged ⇒ the model stayed in kelvin
});

test('Voice coil temp rise, resistance TC, and added mass all convert, each keeping its own resolution', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();

  // Voice coil temp rise: K → °F is a DIFFERENCE conversion (×1.8, no offset — distinct from
  // the Advanced tab's ABSOLUTE temperature, which needs the −273.15 offset).
  const riseField = page.locator('.field', { hasText: 'Voice coil temp rise' });
  const rise = riseField.locator('input');
  const riseUnit = riseField.locator('.unit');
  await rise.fill('40');
  await rise.dispatchEvent('input');
  await rise.blur();
  await expect(riseUnit).toHaveText('K');
  await riseUnit.click();                       // K → °F
  await expect(riseUnit).toHaveText('°F');
  expect(parseFloat(await rise.inputValue())).toBeCloseTo(72, 3); // 40 K rise = 72 °F rise

  // Voice coil resistance TC: 1000/K → %/K → 1/K.
  const tcField = page.locator('.field', { hasText: 'Voice coil resistance TC' });
  const tc = tcField.locator('input');
  const tcUnit = tcField.locator('.unit');
  await expect(tcUnit).toHaveText('1000/K');
  await expect(tc).toHaveValue('3.9000');
  await tcUnit.click();                         // 1000/K → %/K
  await expect(tcUnit).toHaveText('%/K');
  expect(parseFloat(await tc.inputValue())).toBeCloseTo(0.39, 3);

  // Added mass to cone: converting to kg keeps the field's own resolution. The registry states
  // it to 5 decimals of a gram, so kilograms need 8 to say the same thing — those digits ARE the
  // resolution, and a ceiling on them would show a coarser number than the field holds (John,
  // 2026-09-25: "the display resolution must track the absolute precision we want to support").
  const maddField = page.locator('.field', { hasText: 'Added mass to cone' });
  const madd = maddField.locator('input');
  const maddUnit = maddField.locator('.unit');
  await madd.fill('100');
  await madd.dispatchEvent('input');
  await madd.blur();
  await maddUnit.click();                       // g → kg
  await expect(maddUnit).toHaveText('kg');
  await expect(madd).toHaveValue('0.10000000');
  expect(parseFloat(await madd.inputValue())).toBeCloseTo(0.1, 3);
});

// ---- Multi-project registry wiring (PROMPT_RELEASE_HARDENING plan) ------------------------
// These three exercise the plan's own verification list: opening a second project routes
// edits to the correct one and the chart/tab UI reflects whichever is focused; closing the
// last open project shows the explicit empty state (chart AND tab section both gone); and
// switching focus between two open projects never disturbs an edit in progress on either one.
