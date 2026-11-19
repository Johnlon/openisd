import type {Page} from '@playwright/test';
import {expect, test} from '../fixtures.js';
import {
  type BoxReadings, acceptedAfterEntry, backAtStart, differences, enterText, expectedAfterEntry, field, freshProjectReadings, openScreen, openSweepProject, readAllBoxes, sweepValues,
  type SweepBoxType, type SweepInput, type SweepScreen, type SweepViewport,
} from '../fixtures/dependentValues.js';

/**
 * Dependent-value sweep, slice 2: Signal, Advanced and passive radiator inputs (docs/plans/PLAN_20261117_DEPENDENT_VALUE_SWEEP.md;
 * John, 17 Nov 2026: "add more aggressive testing for this style of bug across the app"). Same method as slice 1
 * (box-dependent-values.browser.spec.ts): per input, steps normal, tiny, top, absurdly high, absurdly low, then back; after each step every
 * box on the screens is read and must equal a clean project with only that entry typed; after the last step no calculated box
 * is refused and every box is at its start.
 *
 * Inputs found from the components: Signal tab (OriginalShell, MobileSignalTab): power, drive voltage, Rs; Distance and Angle are
 * greyed read-outs on the desktop ("not modelled yet") and absent on the phone, so they are not inputs. Generator Hz is in the
 * desktop left panel only. Advanced (OriginalShell tab, phone menu pane): temperature, humidity, pressure, sound velocity, air
 * density. Passive radiator (desktop Passive Radiator tab only; the phone shows just Fp and Added mass, covered by slice 1):
 * Vas, Qms, Fs, Sd, Xmax, number of radiators.
 */

const at = (key: string) => (page: Page) => page.locator(`[data-field="${key}"] :is(input[data-numinput], select):visible`).first();

const SCREEN = {
  signal: {name: 'Signal', tab: /^Signal$/},
  advanced: {name: 'Advanced', tab: /^Advanced$/},
  box: {name: 'Box', tab: /^Box$/},
  vented: {name: 'Vented', tab: /^Vented$/},
  radiator: {name: 'Passive Radiator', tab: /^Passive Radiator$/},
} as const satisfies Record<string, SweepScreen>;

interface Group {
  readonly title: string;
  readonly type: SweepBoxType;
  readonly desktop: readonly SweepScreen[];
  readonly phone: readonly SweepScreen[];
  readonly inputs: ReadonlyArray<{readonly label: string; readonly key: string; readonly screen: SweepScreen; readonly desktop: boolean; readonly phone: boolean}>;
}

function row(label: string, key: string, screen: SweepScreen, desktop: boolean, phone: boolean) {
  return {label, key, screen, desktop, phone};
}

const GROUPS: readonly Group[] = [
  {
    title: 'Signal', type: 'vented',
    desktop: [SCREEN.signal, SCREEN.box], phone: [SCREEN.signal, SCREEN.box],
    inputs: [
      row('Power', 'signal_Pin_W', SCREEN.signal, true, true),
      row('Drive voltage', 'signal_DriveV_V', SCREEN.signal, true, true),
      row('Rs', 'signal_Rs_ohm', SCREEN.signal, true, true),
      row('Generator Hz', 'signal_GenHz_hz', SCREEN.signal, true, false),
    ],
  },
  {
    title: 'Advanced', type: 'vented',
    desktop: [SCREEN.advanced, SCREEN.box, SCREEN.vented, SCREEN.signal], phone: [SCREEN.advanced, SCREEN.box, SCREEN.signal],
    inputs: [
      row('Temperature', 'adv_Temp_K', SCREEN.advanced, true, true),
      row('Humidity', 'adv_Humidity_pct', SCREEN.advanced, true, true),
      row('Pressure', 'adv_Pressure_kPa', SCREEN.advanced, true, true),
      row('Sound velocity', 'adv_SoundVelocity_m_per_s', SCREEN.advanced, true, true),
      row('Air density', 'adv_AirDensity_kg_per_m3', SCREEN.advanced, true, true),
    ],
  },
  {
    title: 'Passive radiator', type: 'box-passive-radiator',
    desktop: [SCREEN.radiator, SCREEN.box, SCREEN.signal], phone: [],
    inputs: [
      row('Number of radiators', 'pr_Num', SCREEN.radiator, true, false),
      row('Sd', 'pr_Sd_cm2', SCREEN.radiator, true, false),
      row('Vas', 'pr_Vas_l', SCREEN.radiator, true, false),
      row('Fs', 'pr_Fs_hz', SCREEN.radiator, true, false),
      row('Qms', 'pr_Qms', SCREEN.radiator, true, false),
      row('Xmax', 'pr_Xmax_mm', SCREEN.radiator, true, false),
    ],
  },
];

/** Journeys that fail because of an app bug: the bug file, red until fixed (`test.fail`). Key: "<viewport> <group> <input label>". */
const KNOWN: ReadonlyMap<string, string> = new Map([]);

/** A count list offers only its own options (no absurd entry exists): every other option is picked in turn; a number box gets the six steps. */
async function stepsFor(input: SweepInput, original: string, page: Page): Promise<ReadonlyArray<readonly [string, string]>> {
  const options = await input.locate(page).evaluate(el => el instanceof HTMLSelectElement ? [...el.options].map(o => o.value) : []);
  if (options.length > 0) return options.filter(o => o !== original).map(o => [`option ${o}`, o] as const);
  const v = sweepValues(input, original);
  return [['normal', v.normal], ['tiny', v.tiny], ['top', v.top], ['high', v.high], ['low', v.low]];
}

function baseUrl(): string {
  const port = process.env.OPENISD_TEST_PORT;
  return port ? `http://localhost:${port}` : 'http://localhost:4100';
}

for (const viewport of ['desktop', 'phone'] as const satisfies readonly SweepViewport[]) {
  for (const group of GROUPS) {
    const screens = viewport === 'desktop' ? group.desktop : group.phone;
    const inputs = group.inputs.filter(i => viewport === 'desktop' ? i.desktop : i.phone);
    if (screens.length === 0 || inputs.length === 0) continue;

    test.describe(`${viewport} ${group.title}: every box follows its inputs`, () => {
      for (const item of inputs) {
        const name = `${viewport} ${group.title} ${item.label}`;
        const sweepInput: SweepInput = {label: item.label, field: field(item.key), screen: item.screen.name, locate: at(item.key)};

        test(`${item.label}: normal, tiny, top, absurdly high, absurdly low, back`, async ({appPage: page, browser}) => {
          test.fail(KNOWN.has(name), KNOWN.get(name) ?? '');
          await openSweepProject(page, viewport, group.type);

          const start = await readAllBoxes(page, viewport, screens);
          await openScreen(page, viewport, item.screen);
          const original = await sweepInput.locate(page).inputValue();
          const startedCalculated = start.some(r => r.key.startsWith(`${item.screen.name}|${item.key}`) && r.value === original && r.calculated);
          const steps = await stepsFor(sweepInput, original, page);

          let accepted: BoxReadings = start;
          for (const [step, text] of steps) {
            await openScreen(page, viewport, item.screen);
            await enterText(sweepInput.locate(page), text);
            const typed = await freshProjectReadings(browser, baseUrl(), viewport, group.type, screens, sweepInput, text);
            const expected = expectedAfterEntry(typed, accepted);
            accepted = acceptedAfterEntry(typed, accepted);
            await expect.poll(async () => differences(expected, await readAllBoxes(page, viewport, screens), 'exact', true),
              {message: `${item.label} typed ${step} (${text}): every box must show what a clean project shows`, timeout: 20_000}).toEqual([]);
          }

          await openScreen(page, viewport, item.screen);
          await enterText(sweepInput.locate(page), original);
          const fresh = await freshProjectReadings(browser, baseUrl(), viewport, group.type, screens, sweepInput, original);
          await expect.poll(async () => backAtStart(start, fresh, await readAllBoxes(page, viewport, screens), startedCalculated),
            {message: `${item.label} typed back to ${original}: no calculated box refused, every box back to its start`, timeout: 20_000}).toEqual([]);
        });
      }
    });
  }
}
