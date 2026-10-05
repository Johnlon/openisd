import type {Page} from '@playwright/test';
import {curvesSplSum, expect, focusedPassiveRadiatorSpec, openAProject, setFocusedBoxType, test} from '../fixtures.js';
import {fillAndCommit, numInputByLabel, PageOps} from '../fixtures/numField.js';

/**
 * The Original shell's Passive Radiator tab (the dynamic enclosure tab of a passive-radiator
 * box): the radiator's own Fpr / Vas / Qms / added-mass fields, the Fp target and the data-quality
 * marks on the solved pair. Box-type selection is the Box tab's.
 */

test.describe('Original Passive Radiator tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await openAProject(page);
  });

  test.describe('the bundled ND140-PR', () => {
    test('passive radiator: 30L box + bundled ND140-PR, Fp=30Hz — box readout shows the solved system tuning', async ({ page }) => {
      await setFocusedBoxType(page, 'box-passive-radiator');
      await page.locator('.project-nav li', { hasText: 'Box' }).click();
      await fillAndCommit(numInputByLabel(page, 'Volume').first(), '30');  // scale=1000: 30 → 0.030 m³
      const boxVol = parseFloat(await numInputByLabel(page, 'Volume').first().inputValue());
      expect(boxVol).toBeCloseTo(30, 1);

      // Passive Radiator tab, load the bundled radiator through the browser
      await page.locator('.project-nav li', { hasText: 'Passive Radiator' }).click();
      await page.locator('button.edit-btn', { hasText: 'Select passive radiator' }).click();
      const prBrowser = page.locator('.modal');
      await expect(prBrowser.locator('h2')).toHaveText(/Passive radiator library/);
      const nd140Row = prBrowser.locator('.pr-lib-item .pr-lib-name', { hasText: 'ND140-PR' });
      await expect(nd140Row).toBeVisible();
      await nd140Row.click();
      // Loading a bundled PR closes the library and opens no editor: every field is on the page
      await expect(page.locator('.pr-lib')).toHaveCount(0);

      // The loaded radiator fills the pane with its stored spec
      const paneFpr = parseFloat(await page.locator('#og-pr-fs').inputValue());
      expect(paneFpr).toBeCloseTo(44.2, 1);
      const paneSd = parseFloat(await numInputByLabel(page, 'Sd').first().inputValue());
      expect(paneSd).toBeCloseTo(86.6, 1);

      // Set Target tuning freq (Fp) — below the bare-cone Fpr
      await fillAndCommit(page.locator('#og-pr-fp'), '30.0');

      // Added mass + Fpr-with-mass stay on the PR pane; the solved system-tuning Fh (Fp mirror)
    // is the Box tab's resonance readout.
      const madd = parseFloat(await page.locator('#og-pr-madd').inputValue());
      expect(madd).toBeCloseTo(29.21, 1);
      const fprMass = parseFloat(await page.locator('#og-pr-fs-mass').inputValue());
      expect(fprMass).toBeCloseTo(26.51, 1);
      await page.locator('.project-nav li', { hasText: 'Box' }).click();
      const fhInput = page.locator('#og-box-resonance');
      await expect(fhInput).not.toHaveValue('');
      const fh = parseFloat(await fhInput.inputValue());
      expect(fh).toBeCloseTo(30, 1);
    });

    test('a PR box\'s Fh tracks the PR\'s own added mass, so it is the PR tuning not the sealed Fc', async ({ page }) => {
      const pageOps = new PageOps(page);
      // A PR box needs a real radiator and volume before Fh can resolve (the sample has neither).
      await setFocusedBoxType(page, 'box-passive-radiator');
      await page.locator('.project-nav li', { hasText: 'Box' }).click();
      await fillAndCommit(numInputByLabel(page, 'Volume').first(), '30');

      // Load the bundled ND140-PR through the PR pane — the real user path to a solvable PR.
      await page.locator('.project-nav li', { hasText: 'Passive Radiator' }).click();
      await page.locator('button.edit-btn', { hasText: 'Select passive radiator' }).click();
      const lib = page.locator('.modal');
      await lib.locator('.pr-lib-item .pr-lib-name', { hasText: 'ND140-PR' }).first().click();
      await expect(page.locator('.pr-lib')).toHaveCount(0);
      await expect(page.locator('#og-pr-fs')).toHaveValue(/44\./); // ND140 free-air Fpr loaded

      // The Box tab's Fh is the PR SYSTEM tuning; it tracks the radiator's added mass.
      const readFh = async () => Number(await page.locator('#og-box-resonance').inputValue());
      await pageOps.setNum('#og-pr-madd', '10');
      await page.locator('.project-nav li', { hasText: 'Box' }).first().click();
      const before = await readFh();
      expect(before).toBeGreaterThan(0);

      // Mass on the radiator cone lowers the PR system tuning; the sealed Fc cannot see it.
      await page.locator('.project-nav li', { hasText: 'Passive Radiator' }).click();
      await pageOps.setNum('#og-pr-madd', '50');
      await page.locator('.project-nav li', { hasText: 'Box' }).first().click();
      const after = await readFh();
      expect(after, 'adding 50 g to the radiator must lower Fh — the sealed Fc ignores the PR')
        .toBeLessThan(before);
    });

    // WinISD's PR screen labels the radiator's own free-air resonance "Fs" (docs/winisd_screenshots/
    // passive-radiator-tab.png: Fs 30.00 Hz), which collides with the DRIVER's Fs. The human
    // ruled Fpr, for consistency with the other F* symbols. This is the PR's own resonance — NOT
    // the system tuning, which is the Box tab's Fh (box-tab.png: 40.25 Hz on the same project).
    test('the PR pane labels the radiator\'s own resonance Fpr, not Fs', async ({ page }) => {
      await setFocusedBoxType(page, 'box-passive-radiator');
      await page.locator('.project-nav li', { hasText: 'Passive Radiator' }).click();

      await expect(page.locator('#og-pr-fs').locator('xpath=preceding-sibling::label[1]'))
        .toHaveText('Fpr');
      await expect(page.locator('#og-pr-fs-mass').locator('xpath=preceding-sibling::label[1]'))
        .toHaveText('Fpr (with added mass):');

      // The two are different quantities and must stay on different readouts: the Box tab's Fh is
      // the system tuning (box compliance in series with the PR's own), so it must NOT equal the
      // PR's free-air Fpr.
      const fpr = Number(await page.locator('#og-pr-fs').inputValue());
      await page.locator('.project-nav li', { hasText: 'Box' }).first().click();
      const fh = Number(await page.locator('#og-box-resonance').inputValue());
      expect(fh, 'the system tuning Fh must not be the PR\'s free-air Fpr').not.toBeCloseTo(fpr, 2);
    });
  });

  test.describe('fields', () => {
    test('the passive radiator tab has no box-type selector', async ({page}) => {
      await setFocusedBoxType(page, 'box-passive-radiator');
      await page.locator('.project-nav li', {hasText: 'Passive Radiator'}).click();
      await expect(page.locator('#og-pr-fs')).toBeVisible();            // we are on the PR pane
      await expect(page.locator('#og-box-type-enclosure')).toHaveCount(0);
    });

    test('the PR tab edits Vas and Qms in place, without the editor popup', async ({page}) => {
      await setFocusedBoxType(page, 'box-passive-radiator');
      await page.locator('.project-nav li', {hasText: 'Passive Radiator'}).click();

      const vas = page.locator('#og-pr-vas');
      const qms = page.locator('#og-pr-qms');
      await expect(vas).not.toHaveAttribute('readonly', /.*/);
      await expect(qms).not.toHaveAttribute('readonly', /.*/);

      await vas.fill('7.5');
      await vas.dispatchEvent('input');
      await qms.fill('12.25');
      await qms.dispatchEvent('input');

      const stored = await focusedPassiveRadiatorSpec(page);
      expect(stored.vas_m3).toBeCloseTo(0.0075, 6);   // the field shows litres
      expect(stored.qms).toBeCloseTo(12.25, 3);
    });

    // John, 2026-10-05: every PR field is editable on the page, so the page has no Edit button.
    test('the PR page has no Edit button and edits every passive radiator field in place', async ({page}) => {
      await setFocusedBoxType(page, 'box-passive-radiator');
      await page.locator('.project-nav li', {hasText: 'Passive Radiator'}).click();
      const pane = page.locator('.two-col').filter({ has: page.locator('#og-pr-fs') });

      const header = page.locator('.driver-id-row').filter({ has: page.locator('#og-pr-name') });
      await expect(header.locator('button')).toHaveText(['Select passive radiator', 'Save to library']);

      await page.locator('#og-pr-name').fill('Bench PR 12');
      await fillAndCommit(page.locator('#og-pr-vas'), '7.5');
      await fillAndCommit(page.locator('#og-pr-qms'), '12.25');
      await fillAndCommit(page.locator('#og-pr-fs'), '21.5');
      await fillAndCommit(numInputByLabel(page, 'Sd', pane).first(), '300');
      await fillAndCommit(numInputByLabel(page, 'Xmax', pane).first(), '12');
      await page.locator('#og-pr-count').selectOption('2');

      const stored = await focusedPassiveRadiatorSpec(page);
      expect(stored.name).toBe('Bench PR 12');
      expect(stored.vas_m3).toBeCloseTo(0.0075, 6);   // litres on screen
      expect(stored.qms).toBeCloseTo(12.25, 3);
      expect(stored.fs_hz).toBeCloseTo(21.5, 3);
      expect(stored.sd_m2).toBeCloseTo(0.03, 6);      // cm² on screen
      expect(stored.xmax_m).toBeCloseTo(0.012, 6);    // mm on screen
      expect(stored.count).toBe(2);
    });

    // John, 2026-10-05: "PR Vas is disconnected" — a project made by the New Project wizard with
    // the ND140-PR kept the radiator's catalogue Mms and Cms, so a Vas typed on the page moved nothing.
    test('a Vas typed on the PR page of a wizard-made ND140-PR project moves Fpr with mass, Fh and the SPL curve', async ({page}) => {
      await page.locator('.tb-btn[title*="New project"]').click();
      const wizard = page.locator('.overlay.open');
      const next = wizard.locator('.modal-footer').getByRole('button', { name: 'Next', exact: true });
      await wizard.locator('.dlist .ditem').first().click();
      await next.click();                                        // driver chosen: step 2
      await next.click();                                        // step 3: box type
      await wizard.locator('.field', { hasText: 'Box type' }).locator('select').selectOption('box-passive-radiator');
      await next.click();                                        // step 4: the radiator
      await wizard.locator('#np-pr-select').click();
      await page.locator('.pr-lib-item .pr-lib-name', { hasText: 'ND140-PR' }).first().click();
      await next.click();
      await wizard.locator('input[type="text"]').fill('ND140-PR from the wizard');
      await wizard.locator('button', { hasText: 'Create' }).click();
      await page.locator('.project-nav li', {hasText: 'Passive Radiator'}).click();
      await expect(page.locator('#og-pr-fs')).toHaveValue(/44\./);
      await fillAndCommit(page.locator('#og-pr-madd'), '20');

      const readFh = async () => {
        await page.locator('.project-nav li', { hasText: 'Box' }).first().click();
        const fh = Number(await page.locator('#og-box-resonance').inputValue());
        await page.locator('.project-nav li', {hasText: 'Passive Radiator'}).click();
        return fh;
      };
      const fhBefore = await readFh();
      const fprBefore = await page.locator('#og-pr-fs-mass').inputValue();
      const splBefore = await curvesSplSum(page);

      await fillAndCommit(page.locator('#og-pr-vas'), '20');

      await expect(page.locator('#og-pr-fs-mass')).not.toHaveValue(fprBefore);
      await expect.poll(() => curvesSplSum(page)).not.toBe(splBefore);
      expect(await readFh()).not.toBeCloseTo(fhBefore, 2);
    });

    // John, 2026-10-05: the Edit button is swapped for Save to library.
    test('Save to library puts the page\'s passive radiator in the library under its name', async ({page}) => {
      await setFocusedBoxType(page, 'box-passive-radiator');
      await page.locator('.project-nav li', {hasText: 'Passive Radiator'}).click();

      await page.locator('#og-pr-name').fill('Saved Bench PR');
      await page.locator('button.edit-btn', { hasText: 'Save to library' }).click();

      await page.locator('button.edit-btn', { hasText: 'Select passive radiator' }).click();
      await expect(page.locator('.pr-lib-item .pr-lib-name', { hasText: 'Saved Bench PR' })).toBeVisible();
    });
  });
});

test.describe('Original Passive Radiator tab data quality', () => {
  const PR_KEY = 'openisd_my_passive_radiators';
  const PR_UUID = '00000000-0000-4000-8000-000000000001';

  const entered = (value: number) =>
    ({ state: 'E' as const, value, origin: 'entered', readings: { entered: { read_value: value } } });

  // A conforming passive-radiator record, the same shape `OpenISDPassiveRadiatorStandalone.
  // fromConformingRecord` opens in the My PR library repo.
  function passiveRadiatorRecord() {
    return {
      brand: { value: 'Test PR' },
      model: { value: 'PR250' },
      manufacturer: { value: 'Test PR' },
      provided_by: { value: 'test' },
      comment: { value: '' },
      added: { value: '2026-01-01' },
      uuid: { value: PR_UUID },
      sku: { value: 'TEST-PR', grounds: [{ origin: 'manufacturer_datasheet', reading: 'TEST-PR' }] },
      driver_type: { value: 'passive-radiator' },
      data_sources: { value: {} },
      quality: {
        confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
        parse_errors: [], cross_source_only: [],
      },
      specs: {
        'passive-radiator': {
          Fs_hz: entered(12), Sd_m2: entered(0.025), Cms_m_per_N: entered(0.0009),
          Mms_kg: entered(0.09), Rms_kg_per_s: entered(1.5), Xmax_m: entered(0.015),
        },
      },
    };
  }

  async function configureRadiator(page: Page): Promise<void> {
    await page.locator('.project-nav li', { hasText: 'Passive Radiator' }).click();
    await page.locator('button', { hasText: 'Select passive radiator' }).click();
    await expect(page.locator('.pr-lib')).toBeVisible();
    await page.locator('.pr-lib-item .pr-lib-name', { hasText: 'Test PR PR250' }).click();
    await expect(page.locator('.pr-lib')).toHaveCount(0);
  }

  /** The Box tab's rear-chamber Volume input (the PR box stores it on `passiveRadiator.volume_m3`). */
  const VOLUME_INPUT = '.box-fields-col .field:has(label:text("Volume")) input[type=number]';

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(([key, json]) => {
      localStorage.setItem(key, json);
    }, [PR_KEY, JSON.stringify({ schema: 1, entries: [{ uuid: PR_UUID, record: passiveRadiatorRecord() }] })] as const);
    await page.goto('/');
    await openAProject(page);
  });

  test('an unreachable PR target flags the entered Fp as the cause and the derived outputs as symptoms', async ({ page }) => {
    const pageOps = new PageOps(page);
    await setFocusedBoxType(page, 'box-passive-radiator');
    await pageOps.setNum(VOLUME_INPUT, '30');
    await expect(page.locator(VOLUME_INPUT)).toHaveValue(/30/);
    await configureRadiator(page);

    // The bare-cone ceiling: with no added mass the radiator tunes as high as it ever can. The
    // Fh readout only solves once the mass is stated — so enter ZERO added mass, the bare cone.
    await pageOps.setNum('#og-pr-madd', '0');

    await page.locator('.project-nav li', { hasText: 'Box' }).first().click();
    const ceiling = Number(await page.locator('#og-box-resonance').inputValue());
    expect(ceiling).toBeGreaterThan(0);

    await page.locator('.project-nav li', { hasText: 'Passive Radiator' }).click();
    // The Fp input is capped at the ceiling, so an over-ceiling target can't be typed. Enter one
    // just under it, then make the box bigger: the ceiling falls below the entered Fp.
    await pageOps.setNum('#og-pr-fp', (ceiling * 0.99).toFixed(2));
    await page.locator('.project-nav li', { hasText: 'Box' }).first().click();
    await pageOps.setNum(VOLUME_INPUT, '3000');
    await page.locator('.project-nav li', { hasText: 'Passive Radiator' }).click();

    // The INPUT (entered Fp) is the real problem: dq-root + the ⚠ note.
    const fpInput = page.locator('#og-pr-fp');
    await expect(fpInput).toHaveClass(/dq-root/);
    await expect(fpInput.locator('xpath=following-sibling::*[1]')).toHaveText('⚠');
    await expect(fpInput).toHaveAttribute('title', /is the problem/);

    // The DERIVED mass is the symptom: dq-flag, not dq-root. The solve for it would be negative,
    // which is not a mass, so the field is left unavailable (solver.ts `target-unreachable`)
    // rather than showing a negative number — the flag and the reason are what it carries.
    const maddInput = page.locator('#og-pr-madd');
    await expect(maddInput).toHaveClass(/dq-flag/);
    await expect(maddInput).not.toHaveClass(/dq-root/);
    await expect(maddInput).toHaveValue('');
    await expect(maddInput).toHaveAttribute('title', /cannot be higher than|cannot reach this target/);

    // The readout outputs are redlined too.
    await expect(page.locator('#og-pr-fs-mass').locator('xpath=ancestor::div[contains(@class,"field")][1]'))
      .toHaveClass(/dq-flag/);
    await page.locator('.project-nav li', { hasText: 'Box' }).first().click();
    await expect(page.locator('#og-box-resonance').locator('xpath=ancestor::div[contains(@class,"field")][1]'))
      .toHaveClass(/dq-flag/);
  });

  test('a reachable target shows no DQ anywhere', async ({ page }) => {
    const pageOps = new PageOps(page);
    await setFocusedBoxType(page, 'box-passive-radiator');
    await pageOps.setNum(VOLUME_INPUT, '30');
    await configureRadiator(page);

    // The Fh readout only solves once the mass is stated — enter ZERO added mass (bare cone)
    // so the ceiling is a real number before choosing a reachable target below it.
    await pageOps.setNum('#og-pr-madd', '0');

    await page.locator('.project-nav li', { hasText: 'Box' }).first().click();
    const ceiling = Number(await page.locator('#og-box-resonance').inputValue());

    await page.locator('.project-nav li', { hasText: 'Passive Radiator' }).click();
    await pageOps.setNum('#og-pr-fp', (ceiling * 0.9).toFixed(2));

    await expect(page.locator('#og-pr-fp')).not.toHaveClass(/dq-/);
    await expect(page.locator('#og-pr-madd')).not.toHaveClass(/dq-/);
    await expect(page.locator('#og-pr-fs-mass').locator('xpath=ancestor::div[contains(@class,"field")][1]'))
      .not.toHaveClass(/dq-flag/);
  });
});
