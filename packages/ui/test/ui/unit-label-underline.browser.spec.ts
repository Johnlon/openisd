/**
 * Every clickable unit label (a button titled "Click to change units") shows the dotted underline
 * that tells the user it has a tooltip and can be clicked, on every project screen of both skins
 * (T373, QD4). The underline comes from the unit label control itself, whatever class a screen gives it.
 * Mobile clickable chips keep their grey border and use a blue underline as the click affordance.
 */
import {expect, test} from '../fixtures.js';
import type {Locator} from '@playwright/test';
import {SCREENS} from '../visual/screens.js';

async function waitForLabelsWhereExpected(screenName: string, labels: Locator): Promise<void> {
  if (!/^(tab-box|tab-driver|tab-advanced|tab-enclosure|box-|wizard-.*-step4)/.test(screenName)) return;
  await expect.poll(() => labels.evaluateAll(els => els.filter(el => el.checkVisibility()).length)).toBeGreaterThan(0);
}

// Render the complete app surface: project tabs, all six box types, and every new-project step.
// This catches fields that never acquire the shared component, even when their visible label or
// toggle metadata is missing.
const project_screens = SCREENS.filter(s => s.name !== 'empty');

for (const screen of project_screens) {
  test(`unit labels are dotted-underlined ${screen.skin.name} ${screen.name}`, async ({page}) => {
    await screen.open(page);
    const untagged = await page.locator('.ui-field:visible').evaluateAll(rows => rows.filter(row =>
      row.querySelector('[data-numinput], .ui-field-value > .calculated') !== null,
    ).map(row => {
      // UIFieldBody's third grid child is the unit slot. Inspect the slot by position so this
      // audit still catches a unit that forgot the UnitToggle/unit-label marker entirely.
      const unit = row.children.item(2);
      const text = unit?.textContent?.trim() ?? '';
      return text !== '' && !unit?.classList.contains('unit-label')
        ? `${row.querySelector('label')?.textContent?.trim() ?? '(unlabelled)'}/${text}` : null;
    }).filter((x): x is string => x !== null));
    expect(untagged, `numeric fields with untagged unit slots on ${screen.skin.name} ${screen.name}`).toEqual([]);
    const allUnits = page.locator('.unit-label:visible');
    const labels = page.locator('[role="button"][title^="Click to change units"]');
    // Screens that always show unit labels must show some; the rest are checked for whatever they show.
    await waitForLabelsWhereExpected(screen.name, labels);
    const fields = await allUnits.evaluateAll(els => els.map(el => {
      const cs = getComputedStyle(el);
      return {
        field: el.closest('.ui-field, .mob-field-row, .field')?.querySelector('label')?.textContent?.trim() ?? '(unlabelled)',
        text: el.textContent?.trim() ?? '', role: el.getAttribute('role'), toggle: el.classList.contains('unit-toggle'),
        line: cs.textDecorationLine, style: cs.textDecorationStyle, cursor: cs.cursor,
        bottom: cs.borderBottomStyle, background: cs.backgroundColor, weight: cs.fontWeight,
      };
    }));
    const bad = fields.filter(s => {
      const clickable = s.role === 'button';
      const wrongWeight = screen.skin.name === 'mobile' && s.weight !== '600';
      if (clickable) {
        const expectedStyle = screen.skin.name === 'mobile' ? 'solid' : 'dotted';
        return wrongWeight || !(s.toggle && s.line.includes('underline') && s.style === expectedStyle && s.cursor === 'pointer'
          && (screen.skin.name === 'mobile'
            ? s.background === 'rgb(239, 239, 239)' && s.bottom === 'solid'
            : true));
      }
      return wrongWeight || s.toggle || s.role !== null || s.line !== 'none' || s.style !== 'solid'
        || (screen.skin.name === 'mobile' && s.background !== 'rgba(0, 0, 0, 0)');
    });
    expect(bad, `unit-affordance violations on ${screen.skin.name} ${screen.name}`).toEqual([]);
  });
}
