/**
 * T744, QO534 (John, 11 Nov 2026: "all get the mark"): a stated Cms that disagrees with the stated Vas (Tang Band W5-1138SMF) is
 * explained, in the driver editor opened inside a project, by one plain sentence naming the boxes that disagree and what the maths
 * gives. The raw names of its inputs (roo_kg_per_m3, c_m_per_s) do not appear. A typed value is kept, and every box in the set is marked.
 * ruling: QO532 - the boxes the charts read carry a blue dot right of the label (John, 11 Nov 2026, on the blue dot picture: "do this").
 */
import {COMPLETE_DRIVER_PROJECT_OWPR, editorTab, expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {ensureSampleProject} from '../fixtures/sampleProject.js';
import {boxLooks, boxesChangedByAccent, drawnDots} from '../fixtures/engineDot.js';
import type {DrawnDot} from '../fixtures/engineDot.js';
import {ChartInputs} from '@openisd/design/fields';

ensureSampleProject();

test('the Cms popup of W5-1138SMF in the driver editor says the one sentence, in plain names', async ({page}) => {
  await page.goto('/');
  await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
  await page.locator('.project-nav li', {hasText: 'Driver'}).click();
  await page.getByRole('button', {name: /^Select driver$/i}).click();
  await page.getByText('Tang Band W5-1138SMF', {exact: true}).click();
  await page.locator('.driver-library .use-btn').click();
  await page.locator('.edit-btn', {hasText: 'Edit'}).click();
  await expect(page.locator('.de-modal')).toBeVisible();
  await page.getByRole('button', {name: 'Parameters', exact: true}).click();

  const cms = page.locator('.de-modal .de-fld', {has: page.locator('label', {hasText: /^Cms\b/})});
  await cms.locator('.ui-field-dq-btn').first().click();
  const note = cms.locator('.ui-field-note');
  await expect(note).toBeVisible();
  const text = (await note.textContent()) ?? '';
  expect(text).toMatch(/Vas.*Cms.* disagree by [0-9.]+%: .* gives .*, the box says /);
  expect(text).not.toMatch(/0\.0%/);
  expect(text).not.toMatch(/roo_kg_per|c_m_per_s|_kg_|_m3|_m2/);
});

async function openW5Parameters(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
  await page.locator('.project-nav li', {hasText: 'Driver'}).click();
  await page.getByRole('button', {name: /^Select driver$/i}).click();
  await page.getByText('Tang Band W5-1138SMF', {exact: true}).click();
  await page.locator('.driver-library .use-btn').click();
  await page.locator('.edit-btn', {hasText: 'Edit'}).click();
  await expect(page.locator('.de-modal')).toBeVisible();
  await page.getByRole('button', {name: 'Parameters', exact: true}).click();
}

const fieldOf = (page: import('@playwright/test').Page, label: RegExp) =>
  page.locator('.de-modal .de-fld', {has: page.locator('label', {hasText: label})});

test('a typed Mms is kept; Fs, Mms and Cms all carry the mark, and the popup says what the maths gives', async ({page}) => {
  await openW5Parameters(page);
  const mms = fieldOf(page, /^Mms\b/).locator('input');
  await mms.fill('40.00');
  await mms.blur();
  await expect(mms).toHaveValue('40.00');
  for (const label of [/^Fs\b/, /^Mms\b/, /^Cms\b/]) await expect(fieldOf(page, label).locator('.ui-field-dq-btn')).toHaveCount(1);
  const mmsField = fieldOf(page, /^Mms\b/);
  await mmsField.locator('.ui-field-dq-btn').first().click();
  await expect(mmsField.locator('.ui-field-note')).toContainText(/ disagree by [0-9.]+%: .+ gives .+, the box says /);
});

// QO532 (John, 11 Nov 2026: "not dimmed, just accentuated"; "not like that with the input cell fucked up"; on the blue dot picture: "do this").
const SEVEN = ['BL', 'Cms', 'Le', 'Mms', 'Re', 'Rms', 'Sd'].sort();

function expectDotsDrawn(dots: readonly DrawnDot[], labels: readonly string[]): void {
  expect(dots.map(d => d.label).sort()).toEqual([...labels].sort());
  for (const dot of dots) {
    expect(dot.round, JSON.stringify(dot)).toBe(true);
    expect([dot.width, dot.height], JSON.stringify(dot)).toEqual([ChartInputs.DOT_PX, ChartInputs.DOT_PX]);
    expect(dot.colour, JSON.stringify(dot)).toBe(ChartInputs.DOT_COLOUR_RGB);
    expect(Math.abs(dot.gapFromText - ChartInputs.DOT_GAP_PX), JSON.stringify(dot)).toBeLessThanOrEqual(1);
    expect(dot.hit, JSON.stringify(dot)).toBe('label');
    expect(dot.clippedBy, JSON.stringify(dot)).toEqual([]);
    expect(dot.overlaps, JSON.stringify(dot)).toEqual([]);
  }
}

test('the boxes the charts read carry the blue dot by their label, the others do not, and no box changes size or type', async ({page}) => {
  await openW5Parameters(page);
  expectDotsDrawn(await drawnDots(page, '.de-modal'), SEVEN);
  const looks = await boxLooks(page.locator('.de-modal .de-fld input'));
  expect(looks.filter(l => l.accented)).toHaveLength(7);
  expect(boxesChangedByAccent(looks)).toEqual([]);
  const plainLabels = await page.locator('.de-modal .de-fld:not(.ui-field-drives-charts) > label').evaluateAll(els => [...new Set(els.map(el => getComputedStyle(el, '::after').content))]);
  expect(plainLabels).toEqual(['none']);
});

test('on the phone the seven editor boxes and the Driver tab\'s Re carry the blue dot, and no box changes size or type', async ({page}) => {
  await page.setViewportSize({width: 374, height: 705});
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
  await page.locator('.mob-tab', {hasText: 'Driver'}).click();
  expectDotsDrawn(await drawnDots(page, '.mob-content'), ['Re']);
  expect(boxesChangedByAccent(await boxLooks(page.locator('.mob-content .ui-field .ui-field-value > :first-child')))).toEqual([]);
  await page.getByText('Edit', {exact: true}).click();
  await editorTab(page, 'Parameters');
  expectDotsDrawn(await drawnDots(page, '.de-modal'), SEVEN);
  const looks = await boxLooks(page.locator('.de-modal .de-fld input'));
  expect(looks.filter(l => l.accented)).toHaveLength(7);
  expect(boxesChangedByAccent(looks)).toEqual([]);
  const spacing = await page.locator('.de-modal input, .de-modal label').evaluateAll(els => [...new Set(els.map(el => getComputedStyle(el).letterSpacing))]);
  expect(spacing).toEqual(['normal']);
});
