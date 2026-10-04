import {clearFocusedEnvironment, expect, openAProject, setFocusedBoxType, test} from '../fixtures.js';
import type {BoxTypeName} from '../fixtures.js';
import type {Page} from '@playwright/test';
import {fillAndBlur, fillAndCommit} from '../fixtures/numField.js';

/**
 * The Original shell's Advanced tab: the air constants and their calculated readouts, the loss
 * model selector, and the WinISD Compatibility panel: its presets, the WinISD-vs-conventional
 * switches and the "WinISD errors" switch group.
 */

const soundVelocity = (page: Page) => page.locator('.field', { hasText: 'Sound velocity' }).locator('input');
const airDensity = (page: Page) => page.locator('.field', { hasText: 'Air density' }).locator('input');
const humidity = (page: Page) => page.locator('.field', { hasText: 'Relative humidity' }).locator('input');
const temperature = (page: Page) => page.locator('.field', { hasText: 'Temperature' }).locator('input');
const pressure = (page: Page) => page.locator('.field', { hasText: 'Air pressure' }).locator('input');
const advancedTab = (page: Page) => page.locator('li', { hasText: /^Advanced$/ });

/** Show the Advanced tab for a project whose box is `boxType`; the box is set through the domain. */
async function showAdvancedOn(page: Page, boxType: BoxTypeName): Promise<void> {
  await setFocusedBoxType(page, boxType);
  await advancedTab(page).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await advancedTab(page).click();
});

test.describe('Original Advanced tab', () => {
  test.describe('air constants and readouts', () => {
    test('air density is shown beside sound velocity, both at WinISD\'s own values', async ({ page }) => {
      await expect(soundVelocity(page)).toHaveValue('343.99');
      // WinISD prints 1.20095; the moist-air model gives 1.2009621, which rounds to 1.20096 at
      // the 5 dp WinISD uses — 8.3 ppm from its stored 1.20095217714682.
      await expect(airDensity(page)).toHaveValue('1.19885');
    });

    test('calculated air readouts stay with the three editable air constants', async ({ page }) => {
      const airFields = page.locator('.adv-air-fields');
      await expect(airFields.locator('label', { hasText: 'Temperature' })).toBeVisible();
      await expect(airFields.locator('label', { hasText: 'Relative humidity' })).toBeVisible();
      await expect(airFields.locator('label', { hasText: 'Air pressure' })).toBeVisible();
      await expect(airFields.locator('label', { hasText: 'Sound velocity' })).toBeVisible();
      await expect(airFields.locator('label', { hasText: 'Air density' })).toBeVisible();
      await expect(airFields.locator('input[readonly]')).toHaveCount(2);
    });

    test('air constants and calculated readouts use two columns', async ({ page }) => {
      const positions = await page.locator('.adv-air-fields .field').evaluateAll(fields =>
        fields.map(field => ({
          label: field.querySelector('label')?.textContent?.trim(),
          left: Math.round(field.getBoundingClientRect().left),
          top: Math.round(field.getBoundingClientRect().top),
        })),
      );

      const left = positions.filter(field => ['Temperature', 'Relative humidity', 'Air pressure'].includes(field.label ?? ''));
      const right = positions.filter(field => ['Sound velocity', 'Air density'].includes(field.label ?? ''));

      expect(new Set(left.map(field => field.left)).size).toBe(1);
      expect(new Set(right.map(field => field.left)).size).toBe(1);
      expect(right[0]!.left).toBeGreaterThan(left[0]!.left);
      expect(right.find(field => field.label === 'Sound velocity')!.top)
        .toBe(left.find(field => field.label === 'Temperature')!.top);
      expect(right.find(field => field.label === 'Air density')!.top)
        .toBe(left.find(field => field.label === 'Relative humidity')!.top);
      expect(Math.max(...positions.map(field => field.top)) - Math.min(...positions.map(field => field.top))).toBeLessThan(180);
    });

    test('a project\'s stored temperature, humidity and pressure are shown, not blank', async ({ page }) => {
      // The sample project stores its own environment (generateSample.ts). A stored value wins over
      // the Options environment because it was entered, not deleted (John, 2026-09-21).
      await expect(temperature(page)).toHaveValue(/293\.15/);
      await expect(humidity(page)).toHaveValue(/50/);
      await expect(pressure(page)).toHaveValue(/101325/);
    });

    test('relative humidity moves both readouts — the input is not inert', async ({ page }) => {
      await humidity(page).fill('100');
      await humidity(page).blur();
      await expect(airDensity(page)).toHaveValue('1.19360');
      await expect(soundVelocity(page)).not.toHaveValue('343.99');
    });

    test('typing an environment value sticks — it does not reset to blank on blur', async ({ page }) => {
      await fillAndBlur(temperature(page), '301');
      await expect(temperature(page)).toHaveValue(/301/);
      await fillAndBlur(humidity(page), '45');
      await expect(humidity(page)).toHaveValue(/45/);
    });

    test('BUG (human, 2026-09-13): deleting any environment field drops the stored value and shows the app default as CALCULATED', async ({ page }) => {
      // The BUG 8 test only cleared a field that was NEVER stored (a fresh project). This is the
      // stored-then-cleared path, which reused the OLD value instead (temp/pressure) or corrupted
      // the domain to '' (humidity — the raw v-model.number emits '' on clear, which the `!== null`
      // guard passed through).
      await page.locator('.project-nav li', { hasText: 'Advanced' }).click();
      const temp = temperature(page);
      const hum = humidity(page);
      const pres = pressure(page);

      // COMPLETE_DRIVER_PROJECT_OWPR stores all three env fields explicitly (generateSample.ts),
      // so they start ENTERED (green), not calculated — the calculated/app-default fallback is
      // only exercised below, after each field is explicitly deleted.
      await expect(temp).toHaveValue(/293\.15/);
      await expect(hum).toHaveValue(/50/);
      await expect(pres).toHaveValue(/101325/);
      await expect(temp).not.toHaveClass(/calculated/);
      await expect(hum).not.toHaveClass(/calculated/);
      await expect(pres).not.toHaveClass(/calculated/);
      await expect(temp.evaluate((el: Element) => el.closest('.field')?.className)).resolves.toMatch(/entered/);

      // Type values — they stick and turn green "entered".
      await fillAndCommit(temp, '301');
      await fillAndCommit(hum, '45');
      await fillAndCommit(pres, '99000');
      await expect(temp).toHaveValue(/301/);
      await expect(hum).toHaveValue(/45/);
      await expect(pres).toHaveValue(/99000/);
      await expect(temp).not.toHaveClass(/calculated/);

      // DELETE each — the stored value must drop, the app default must flow through, and the
      // field must present as CALCULATED again.
      await fillAndCommit(temp, '');
      await fillAndCommit(hum, '');
      await fillAndCommit(pres, '');

      await expect(temp).toHaveValue(/293\.15/);
      await expect(hum).toHaveValue(/30/);
      await expect(pres).toHaveValue(/101325/);
      await expect(temp).toHaveClass(/calculated/);
      await expect(hum).toHaveClass(/calculated/);
      await expect(pres).toHaveClass(/calculated/);
      await expect(temp.evaluate((el: Element) => el.closest('.field')?.className)).resolves.not.toMatch(/entered/);
      await expect(hum.evaluate((el: Element) => el.closest('.field')?.className)).resolves.not.toMatch(/entered/);
      await expect(pres.evaluate((el: Element) => el.closest('.field')?.className)).resolves.not.toMatch(/entered/);
    });

    test('a project\'s stored humidity survives a reload — not reset to the Options default on mount', async ({ page }) => {
      // 55% is deliberately distinct from the app-level Options → General → Environment default
      // (30%, presentationState.ts). BUG_20260823_advtemp_advhumidity_advpressure_overwrote_a_
      // loaded_projects_env_on_mount.md: the Advanced-tab env inputs used to be local refs seeded
      // from that default, pushed into the project by an `{immediate:true}` watch that fired again
      // on every mount — so a reload silently reset a loaded project's own value back to 30%. This
      // pins the fix: reload after the value is actually persisted, and it must come back as 55.
      await humidity(page).fill('55');
      await humidity(page).blur();

      await expect.poll(async () => {
        const raw = await page.evaluate(() => localStorage.getItem('openisd_open_sessions'));
        if (!raw) return null;
        try {
          const session: unknown = JSON.parse(raw);
          if (typeof session !== 'object' || session === null || !('entries' in session) || !Array.isArray(session.entries)) return null;
          const entries: unknown[] = session.entries;
          const first: unknown = entries[0];
          const text = typeof first === 'object' && first !== null && 'text' in first && typeof first.text === 'string' ? first.text : undefined;
          if (!text) return null;
          const parsedProject: unknown = JSON.parse(text);
          if (typeof parsedProject !== 'object' || parsedProject === null) return null;
          const activeState: unknown = 'edited' in parsedProject && parsedProject.edited ? parsedProject.edited
            : 'saved' in parsedProject ? parsedProject.saved : undefined;
          // Persisted fields are cells — `{state, value}` — not bare numbers.
          if (typeof activeState !== 'object' || activeState === null || !('environment' in activeState)) return null;
          const environment: unknown = activeState.environment;
          if (typeof environment !== 'object' || environment === null || !('humidity_pct' in environment)) return null;
          const humidity: unknown = environment.humidity_pct;
          if (typeof humidity !== 'object' || humidity === null || !('value' in humidity)) return null;
          const value: unknown = humidity.value;
          return typeof value === 'number' ? value : null;
        } catch { return null; }
      }).toBe(55);

      await page.reload();
      await page.locator('li', { hasText: /^Advanced$/ }).click();

      await expect(humidity(page)).toHaveValue('55.00');
    });

    test('unticking "WinISD air model" switches the readouts to the moist-air physics model', async ({ page }) => {
      const useWinisd = page.locator('label', { hasText: 'WinISD air model' }).locator('input[type=checkbox]');
      await expect(useWinisd).toBeChecked();   // WinISD parity by default (QO95)

      // The sample project stores 20 °C / RH 50 / 101325 Pa, where the two models agree at
      // display precision (343.99 / 1.19885 both ways) — an untick there is invisible. Saturate
      // the air first: at RH 100 the models part ways (rho 1.19360 WinISD vs 1.19358 moist).
      await humidity(page).fill('100');
      await humidity(page).blur();
      await expect(airDensity(page)).toHaveValue('1.19360');

      await page.locator('label', { hasText: 'WinISD air model' }).click();

      await expect(airDensity(page)).toHaveValue('1.19358');
      await expect(soundVelocity(page)).toHaveValue('344.74');

      // And the readouts keep tracking the moist-air model after the switch.
      await humidity(page).fill('30');
      await humidity(page).blur();
      await expect(airDensity(page)).toHaveValue('1.20096');
      await expect(soundVelocity(page)).toHaveValue('343.68');
    });
  });

  test.describe('a project with no stored environment', () => {
    test('shows the Options environment and recomputes the readouts on input', async ({ page }) => {
      // A freshly built project has no environment of its own, so the Advanced tab falls back to the
      // Options environment and the derived c/ρ follow it.
      await clearFocusedEnvironment(page);
      await advancedTab(page).click();
      const vel = soundVelocity(page);
      const density = airDensity(page);
      const hum = humidity(page);
      const temp = temperature(page);

      await expect(temp).toHaveValue(/293\.15/);
      await expect(hum).toHaveValue(/30/);
      await expect(pressure(page)).toHaveValue(/101325/);
      // c = √(γRT) at 293.15 K → 343.68 m/s; ρ = p/(RT) → 1.20095 kg/m³.
      await expect(vel).toHaveValue(/343\.68/);
      await expect(density).toHaveValue(/1\.20\d/);

      await fillAndBlur(temp, '301');
      await expect(vel).toHaveValue(/348\.5\d/);
      await expect(density).toHaveValue(/1\.16\d/);

      // RH must BOTH stick AND move the derived constants: 80 % air is wetter, so c rises and ρ drops
      // on top of the temperature effect.
      const velAt301_30 = parseFloat(await vel.inputValue());
      const rhoAt301_30 = parseFloat(await density.inputValue());
      await fillAndBlur(hum, '80');
      await expect(hum).toHaveValue(/80/);
      await expect(vel).toHaveValue(/349\.7\d/);
      expect(parseFloat(await vel.inputValue())).toBeGreaterThan(velAt301_30);
      expect(parseFloat(await density.inputValue())).toBeLessThan(rhoAt301_30);

      // Out-of-range entry is data, not an error to clamp: 153 % stays readable and raises the DQ flag.
      await fillAndBlur(hum, '153');
      await expect(hum).toHaveValue(/153/);
      await expect(page.locator('.adv-air-fields .field', { hasText: 'Relative humidity' })).toHaveClass(/dq-flag/);
    });

    test('moves density with pressure while sound velocity stays flat', async ({ page }) => {
      await clearFocusedEnvironment(page);
      await advancedTab(page).click();
      const pres = pressure(page);
      const vel = soundVelocity(page);
      const density = airDensity(page);

      // A fresh project matches WinISD out of the box (QO95): parity air model on, ρ/c at WinISD's
      // own 1.20095 / 343.68. (The sample project stores an environment where the models differ by 8.3 ppm.)
      await expect(page.locator('label', { hasText: 'WinISD air model' }).locator('input[type=checkbox]')).toBeChecked();
      await expect(density).toHaveValue(/1\.20095/);
      await expect(vel).toHaveValue(/343\.68/);

      // ρ·c² = γ·p holds in both air models, so ρ scales with p while c stays flat.
      await fillAndBlur(pres, '110000');
      await expect(pres).toHaveValue(/110000/);
      await expect(density).toHaveValue(/1\.30404/);
      await expect(vel).toHaveValue(/343\.65/);

      await fillAndBlur(pres, '101325');
      await expect(density).toHaveValue(/1\.20095/);
    });
  });

  test.describe('loss model', () => {
    test('the Box tab has no loss model selector; it lives in the WinISD Compatibility panel only', async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Box' }).click();
      await expect(page.locator('select#lossmode')).toHaveCount(0);
    });

    test('the WinISD Compatibility loss model selector defaults to WinISD, unlabelled, with three options', async ({ page }) => {
      await setFocusedBoxType(page, 'sealed');
      const sel = page.locator('select#adv-lossmode');
      await expect(sel).toBeVisible();
      await expect(sel).toHaveValue('winisd-lossy');
      await expect(sel.locator('option')).toHaveText(['WinISD lossy model', 'Lossless model', 'Conventional lossy model']);
      await expect(page.locator('.sim-options-box label', { hasText: 'Loss model' })).toHaveCount(0);
      const help = page.locator('.sim-options-box .field', { has: sel });
      for (const name of ['WinISD lossy model', 'Lossless model', 'Conventional lossy model']) {
        await expect(help).toHaveAttribute('title', new RegExp(name));
      }
      await expect(help).not.toHaveAttribute('title', /Custom Q|None/);
    });

    test('the WinISD Compatibility panel ends just below its last switch', async ({ page }) => {
      const panel = (await page.locator('.sim-options-box').boundingBox())!;
      // The switches sit in two columns: the lowest switch, whichever column it is in.
      const bottoms = await page.locator('.sim-options-box label[data-field-key]').evaluateAll(
        els => els.map(e => e.getBoundingClientRect().bottom));
      expect(panel.y + panel.height - Math.max(...bottoms)).toBeLessThanOrEqual(10);
    });

    test('the loss model drop-down is a design choice: it never carries the warning class', async ({page}) => {
      const frame = page.locator('.sim-options-box .field', {has: page.locator('select#adv-lossmode')});
      await showAdvancedOn(page, 'box-passive-radiator');
      for (const mode of ['winisd-lossy', 'lossless', 'conventional-lossy']) {
        await page.locator('select#adv-lossmode').selectOption(mode);
        await expect(frame, mode).not.toHaveClass(/error-switch-marked/);
      }
    });
  });

  test.describe('WinISD Compatibility panel', () => {
    test('WinISD\'s inductance model has no switch of its own — "WinISD driver model" covers it (John, 2026-09-26)', async ({ page }) => {
      await expect(page.locator('[data-field-key="winisdInductance"]')).toHaveCount(0);
      const driverCalcs = page.locator('[data-field-key="winisdDriverModel"]');
      await expect(driverCalcs).toHaveAttribute('title', /inductance/);
      await expect(driverCalcs).toHaveAttribute('title', /WinISD bug/);
    });

    test('WinISD Compatibility labels are unclipped and drop the "Use" prefix', async ({ page }) => {
      const panel = page.locator('.sim-options-box', { hasText: 'WinISD Compatibility' });
      const labels = panel.locator('label[data-field-key]');
      await expect(labels).toHaveText([/WinISD air model/, /WinISD phase wrapping/, /WinISD driver count/, /WinISD flat response/, /WinISD ABC intra-port velocity/, /WinISD driver model/, /WinISD VA model/, /PR Npr resonance/, /WinISD Bessel high-pass/]);
      const panelBox = (await panel.boundingBox())!;
      const clipRight = await panel.evaluate(el => {
        // The visible right edge: the panel's own, or an ancestor's that clips it first.
        let right = el.getBoundingClientRect().right;
        for (let a = el.parentElement; a; a = a.parentElement) {
          if (getComputedStyle(a).overflowX !== 'visible') right = Math.min(right, a.getBoundingClientRect().right);
        }
        return right;
      });
      for (const label of await labels.all()) {
        const textRight = await label.evaluate(el => {
          const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect().right;
        });
        expect(textRight, await label.innerText()).toBeLessThanOrEqual(Math.min(panelBox.x + panelBox.width, clipRight));
      }
    });

    test('Advanced layout: no air-field label text is clipped by its label box', async ({ page }) => {
      const labels = page.locator('.adv-air-fields .field label');
      await expect(labels).toHaveCount(5);
      for (const label of await labels.all()) {
        const [scroll, client] = await label.evaluate(el => [el.scrollWidth, el.clientWidth]);
        expect(scroll, await label.innerText()).toBeLessThanOrEqual(client);
      }
    });

    test('the three presets sit in the WinISD Compatibility panel and show which one the project matches', async ({ page }) => {
      const panel = page.locator('.sim-options-box', { hasText: 'WinISD Compatibility' });
      const presets = panel.locator('.compat-preset-btn');
      await expect(presets).toHaveText(['Recommended (debugged)', 'WinISD-ish', 'WinISD incl. bugs']);
      const now = panel.locator('.compat-preset-match-label');
      await expect(now).toHaveText('WinISD-ish');
      await expect(presets.nth(1)).toHaveAttribute('aria-pressed', 'true');
      await presets.nth(0).click();
      await expect(now).toHaveText('Recommended (debugged)');
      await expect(page.locator('[data-field-key="winisdDriverCountModel"] input')).not.toBeChecked();
      await presets.nth(2).click();
      await expect(now).toHaveText('WinISD incl. bugs');
      await expect(page.locator('[data-field-key="winisdDriverModel"] input')).toBeChecked();
      await page.locator('[data-field-key="winisdWrapPhase"] input').uncheck();
      await expect(now).toHaveText('Custom');
    });

    test('Advanced layout: the transmission-line label wraps before "for"', async ({ page }) => {
      const label = page.locator('label[data-field-key="tlPortModel"]');
      const [firstTop, forTop] = await label.evaluate(el => {
        const text = [...el.childNodes].find(n => n.nodeType === Node.TEXT_NODE && n.textContent!.includes('for port'))!;
        const at = (i: number) => { const r = document.createRange(); r.setStart(text, i); r.setEnd(text, i + 1); return r.getBoundingClientRect().top; };
        const s = text.textContent!;
        return [at(s.indexOf('U')), at(s.indexOf('for port'))];
      });
      expect(forTop).toBeGreaterThan(firstTop);
    });

    test('Advanced layout: the air readout column sits 16 px from the air-constant column', async ({ page }) => {
      const rows = page.locator('.adv-air-fields .field-row');
      const leftRight = Math.max(...await Promise.all([0, 1, 2].map(async i => {
        const b = (await rows.nth(i).boundingBox())!; return b.x + b.width;
      })));
      const rightLeft = (await rows.nth(3).boundingBox())!.x;
      expect(Math.round(rightLeft - leftRight)).toBe(16);
    });

    test('"WinISD VA model" switches the VA chart between WinISD\'s Re and the amplifier\'s Re + Rg (BUG_20260927)', async ({ page }) => {
      const va = page.locator('[data-field-key="winisdVaModel"]');
      await expect(va).toHaveAttribute('title', /Re \+ Rg/);
      await expect(va).toHaveAttribute('title', /Amplifier apparent load power \(VA\) chart only/);
      await expect(va).toHaveAttribute('title', /'Rg is at driver side' on, Z already includes Rg and WinISD adds it again/);
      await expect(va).toHaveAttribute('title', /Z seen by the amplifier/);
      await expect(va.locator('input')).not.toBeChecked();
      await page.locator('.compat-preset-btn', { hasText: 'WinISD incl. bugs' }).click();
      await expect(va.locator('input')).toBeChecked();
      await page.locator('.compat-preset-btn', { hasText: 'WinISD-ish' }).click();
      await expect(va.locator('input')).not.toBeChecked();
    });

    test('the VA chart carries the ≠W cue while "WinISD VA model" is off', async ({ page }) => {
      await page.locator('.chart-select').click();
      await page.locator('.chart-item', { hasText: 'Amplifier apparent load power' }).click();
      const cue = page.locator('.chart-deviation-cue');
      await expect(cue).toHaveCount(1);
      await expect(cue.locator('.winisd-deviation-cue')).toHaveAttribute('title', /WinISD VA uses Re, not Re \+ Rg/);
      await page.locator('[data-field-key="winisdVaModel"] input').check();
      await expect(cue).toHaveCount(0);
    });

    test('the passive-radiator count carries the ≠W cue while "PR Npr resonance" is off', async ({ page }) => {
      await showAdvancedOn(page, 'box-passive-radiator');
      const cue = page.locator('.field', { has: page.locator('#og-pr-count') }).locator('.winisd-deviation-cue');
      await expect(cue).toHaveCount(1);
      await page.locator('[data-field-key="winisdPrNprResonance"] input').check();
      await expect(cue).toHaveCount(0);
    });

    for (const [key, titleText] of [
      ['winisdDriverCountModel', /each in Vb\/N/],
      ['winisdFlatModel', /uncapped/],
    ] as const) {
      test(`"${key}" is on by default, can be switched off, and WinISD-ish turns it back on`, async ({ page }) => {
        const box = page.locator(`[data-field-key="${key}"]`);
        await expect(box).toHaveAttribute('title', titleText);
        await expect(box.locator('input')).toBeChecked();
        await box.locator('input').uncheck();
        await expect(box.locator('input')).not.toBeChecked();
        await page.locator('.compat-preset-btn', { hasText: 'WinISD-ish' }).click();
        await expect(box.locator('input')).toBeChecked();
      });
    }

    test('the error group fits inside the Compatibility panel', async ({page}) => {
      await showAdvancedOn(page, 'abc');
      const panel = page.locator('.sim-options-box', {hasText: 'WinISD Compatibility'});
      const panelBox = (await panel.boundingBox())!;
      const rights = await panel.locator('.error-switch-group, .error-switch-group *').evaluateAll(
        els => els.map(e => e.getBoundingClientRect().right));
      expect(Math.max(...rights)).toBeLessThanOrEqual(panelBox.x + panelBox.width + 1);
    });
  });

  test.describe('WinISD errors group', () => {
    const ERROR_KEYS = ['winisdDriverModel', 'winisdVaModel', 'winisdPrNprResonance', 'winisdBesselHighpass'];
    /** The box type each error switch acts on; a switch that applies everywhere is shown on an ABC box. */
    const BOX_FOR: Record<string, BoxTypeName> = {winisdPrNprResonance: 'box-passive-radiator'};
    /** The Bessel switch acts only on a project with a Bessel high-pass filter, so it cannot be ticked here. */
    const TICKABLE_KEYS = ERROR_KEYS.filter(key => key !== 'winisdBesselHighpass');
    const DESIGN_KEYS = ['useWinisdAirModel', 'winisdWrapPhase', 'winisdDriverCountModel', 'winisdFlatModel', 'winisdAbcIntraPortVelocity'];

    test('the error switches carry the warning class, unticked and ticked', async ({page}) => {
      for (const key of TICKABLE_KEYS) {
        await showAdvancedOn(page, BOX_FOR[key] ?? 'abc');
        const label = page.locator(`label[data-field-key="${key}"]`);
        const box = label.locator('input[type=checkbox]');
        await expect(label, key).toHaveClass(/error-switch-marked/);
        await expect(label.locator('.error-switch-mark')).toBeVisible();
        for (const want of [false, true]) {
          await box.setChecked(want);
          await expect(label, `${key} ticked=${want}`).toHaveClass(/error-switch-marked/);
          await expect(label).toHaveClass(want ? /error-switch-on/ : /^(?!.*error-switch-on)/);
        }
      }
    });

    test('the design-choice switches do not carry it', async ({page}) => {
      await page.locator('li', {hasText: /^Advanced$/}).click();
      for (const key of [...DESIGN_KEYS, 'simVcInductance', 'rgAtDriverSide']) {
        await expect(page.locator(`label[data-field-key="${key}"]`), key).not.toHaveClass(/error-switch-marked/);
      }
    });

    test('every error switch tooltip starts "Reproduces a WinISD error."', async ({page}) => {
      await page.locator('li', {hasText: /^Advanced$/}).click();
      for (const key of ERROR_KEYS) {
        await expect(page.locator(`label[data-field-key="${key}"]`), key).toHaveAttribute('title', /^Reproduces a WinISD error\.\n/);
      }
    });

    test('the error switches sit under one "WinISD errors" heading with its own tooltip', async ({page}) => {
      await page.locator('li', {hasText: /^Advanced$/}).click();
      const group = page.locator('.error-switch-group');
      await expect(group).toHaveCount(1);
      await expect(group.locator('.error-switch-group-head')).toHaveText('WinISD errors');
      await expect(group).toHaveAttribute('title', /^WinISD errors: /);
      for (const key of ERROR_KEYS) await expect(group.locator(`label[data-field-key="${key}"]`)).toHaveCount(1);
      for (const key of DESIGN_KEYS) await expect(group.locator(`label[data-field-key="${key}"]`)).toHaveCount(0);
    });

    test('the ABC velocity switch (a WinISD convention, not an error switch) is editable on an ABC box only', async ({page}) => {
      const box = page.locator('label[data-field-key="winisdAbcIntraPortVelocity"] input');
      await showAdvancedOn(page, 'vented');
      await expect(box).toBeDisabled();
      await expect(page.locator('label[data-field-key="winisdAbcIntraPortVelocity"]')).toHaveClass(/compat-switch-na/);
      await showAdvancedOn(page, 'abc');
      await expect(box).toBeEnabled();
      await expect(page.locator('label[data-field-key="winisdAbcIntraPortVelocity"]')).not.toHaveClass(/compat-switch-na/);
    });

    test('the Bessel high-pass switch is editable only while a Bessel high-pass filter exists', async ({page}) => {
      const label = page.locator('label[data-field-key="winisdBesselHighpass"]');
      await page.locator('li', {hasText: /^Advanced$/}).click();
      await expect(label.locator('input')).toBeDisabled();
      await expect(label).toHaveClass(/error-switch-na/);
      await expect(label).toHaveClass(/error-switch-marked/);
      await expect(label.locator('.error-switch-mark')).toBeVisible();
    });

    test('the PR Npr switch is editable on a passive radiator box only', async ({page}) => {
      const label = page.locator('label[data-field-key="winisdPrNprResonance"]');
      await showAdvancedOn(page, 'vented');
      await expect(label.locator('input')).toBeDisabled();
      await expect(label).toHaveClass(/error-switch-na/);
      await showAdvancedOn(page, 'box-passive-radiator');
      await expect(label.locator('input')).toBeEnabled();
      await expect(label).not.toHaveClass(/error-switch-na/);
    });
  });
});
