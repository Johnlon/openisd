import type { Page } from '@playwright/test';
import { test, expect, openAProject } from '../fixtures.js';

// The generic DQ rule, driven through the PR solved pair: an unreachable target tuning flags
// EVERY field in the relation — but the ENTERED one (the Fp the user typed) is the real problem
// and gets the "root" treatment, while the CALCULATED ones (the derived mass, the readouts) are
// the symptom. Both are redlined; only the entered one is called out as the cause.

const PR_KEY = 'openisd_my_passive_radiators';
const PR_UUID = '00000000-0000-4000-8000-000000000001';

const entered = (value: number) => ({ origin: 'entered', readings: { entered: { read_value: value } } });

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
    authoritative: { value: 'openisd' },
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
  await page.locator('button', { hasText: 'Select PR' }).click();
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
  await page.locator('select#og-box-type').selectOption('box-passive-radiator');
  await page.locator(VOLUME_INPUT).fill('30');
  await page.locator(VOLUME_INPUT).blur();
  await expect(page.locator(VOLUME_INPUT)).toHaveValue(/30/);
  await configureRadiator(page);

  // The bare-cone ceiling: with no added mass the radiator tunes as high as it ever can.
  await page.locator('.project-nav li', { hasText: 'Box' }).first().click();
  const ceiling = Number(await page.locator('#og-box-resonance').inputValue());
  expect(ceiling).toBeGreaterThan(0);

  await page.locator('.project-nav li', { hasText: 'Passive Radiator' }).click();
  await page.locator('#og-pr-fp').fill((ceiling * 1.5).toFixed(2));
  await page.locator('#og-pr-fp').blur();

  // The INPUT (entered Fp) is the real problem: dq-root + the ⚠ note.
  const fpInput = page.locator('#og-pr-fp');
  await expect(fpInput).toHaveClass(/dq-root/);
  await expect(fpInput.locator('xpath=following-sibling::*[1]')).toHaveText('⚠');
  await expect(fpInput).toHaveAttribute('title', /is the problem/);

  // The DERIVED mass (calculated, negative) is the symptom: dq-flag, not dq-root.
  const maddInput = page.locator('#og-pr-madd');
  await expect(maddInput).toHaveClass(/dq-flag/);
  await expect(maddInput).not.toHaveClass(/dq-root/);
  await expect(maddInput).toHaveAttribute('title', /not the issue|flagged input/);

  // The readout outputs are redlined too.
  await expect(page.locator('#og-pr-fs-mass').locator('xpath=ancestor::div[contains(@class,"field")][1]'))
    .toHaveClass(/dq-flag/);
  await page.locator('.project-nav li', { hasText: 'Box' }).first().click();
  await expect(page.locator('#og-box-resonance').locator('xpath=ancestor::div[contains(@class,"field")][1]'))
    .toHaveClass(/dq-flag/);
});

test('a reachable target shows no DQ anywhere', async ({ page }) => {
  await page.locator('select#og-box-type').selectOption('box-passive-radiator');
  await page.locator(VOLUME_INPUT).fill('30');
  await page.locator(VOLUME_INPUT).blur();
  await configureRadiator(page);

  await page.locator('.project-nav li', { hasText: 'Box' }).first().click();
  const ceiling = Number(await page.locator('#og-box-resonance').inputValue());

  await page.locator('.project-nav li', { hasText: 'Passive Radiator' }).click();
  await page.locator('#og-pr-fp').fill((ceiling * 0.9).toFixed(2));
  await page.locator('#og-pr-fp').blur();

  await expect(page.locator('#og-pr-fp')).not.toHaveClass(/dq-/);
  await expect(page.locator('#og-pr-madd')).not.toHaveClass(/dq-/);
  await expect(page.locator('#og-pr-fs-mass').locator('xpath=ancestor::div[contains(@class,"field")][1]'))
    .not.toHaveClass(/dq-flag/);
});