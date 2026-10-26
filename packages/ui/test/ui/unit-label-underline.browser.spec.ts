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
    const unwrappedNumeric = await page.locator('input[data-numinput]:visible, input[type=number]:visible').evaluateAll(inputs => inputs
      .filter(input => input.closest('.ui-field') === null)
      .map(input => `${input.getAttribute('aria-label') ?? input.getAttribute('name') ?? '(unlabelled)'}: outside .ui-field`));
    expect(unwrappedNumeric, `numeric controls outside the shared field component on ${screen.skin.name} ${screen.name}`).toEqual([]);
    const untagged = await page.locator('.ui-field:visible').evaluateAll(rows => rows.filter(row =>
      row.querySelector('[data-numinput], input[type=number], .ui-field-value > .calculated') !== null,
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
        decorationColor: cs.textDecorationColor, decorationThickness: cs.textDecorationThickness,
        decorationOffset: cs.textUnderlineOffset,
        bottom: cs.borderBottomStyle, background: cs.backgroundColor, weight: cs.fontWeight,
      };
    }));
    const bad = fields.filter(s => {
      const clickable = s.role === 'button';
      const wrongWeight = screen.skin.name === 'mobile' && s.weight !== '600';
      const wrongToggleSemantics = clickable !== s.toggle;
      const wrongMobileBackground = screen.skin.name === 'mobile'
        && s.background !== (s.text === '' ? 'rgba(0, 0, 0, 0)' : clickable ? 'rgb(239, 239, 239)' : 'rgb(255, 255, 255)');
      if (clickable) {
        const expectedStyle = screen.skin.name === 'mobile' ? 'solid' : 'dotted';
        return wrongWeight || wrongToggleSemantics || wrongMobileBackground || !(s.toggle && s.line.includes('underline') && s.style === expectedStyle && s.cursor === 'pointer'
          && (screen.skin.name === 'mobile'
            ? s.bottom === 'solid' && s.decorationColor === 'rgb(24, 104, 209)' && s.decorationThickness === '1px' && s.decorationOffset === '5px'
            : true));
      }
      return wrongWeight || wrongToggleSemantics || s.role !== null || s.line !== 'none' || s.style !== 'solid'
        || wrongMobileBackground;
    });
    expect(bad, `unit-affordance violations on ${screen.skin.name} ${screen.name}`).toEqual([]);

  });
}

// Every mobile screen that renders the classic numeric field layout checks that the unit chip
// stays inside its value control and warning/WinISD adornments stay in-row without covering it.
const mobile_screens = project_screens.filter(s => s.skin.name === 'mobile');
for (const screen of mobile_screens) {
  test(`phone unit and adornment geometry ${screen.name}`, async ({page}) => {
    await screen.open(page);
    const misplaced = await page.locator('.mob-classic .ui-field:visible').evaluateAll(rows => rows.flatMap(row => {
      const label = row.querySelector('label')?.textContent?.trim() ?? '(unlabelled)';
      const numeric = row.querySelector('[data-numinput], input[type=number], .ui-field-value > .calculated');
      if (!numeric) return [];
      const unit = row.querySelector<HTMLElement>('.ui-field-unit');
      const hasUnit = unit !== null && unit.textContent?.trim() !== '';
      const control = row.querySelector<HTMLElement>('.ui-field-value input, .ui-field-value select, .ui-field-value .mob-readonly');
      const rr = row.getBoundingClientRect();
      const inside = (r: DOMRect, outer: DOMRect) => r.left >= outer.left - 0.5 && r.top >= outer.top - 0.5
        && r.right <= outer.right + 0.5 && r.bottom <= outer.bottom + 0.5;
      const problems: string[] = [];
      if (hasUnit && !control) problems.push(`${label}: unit has no value control`);
      if (hasUnit && control && unit) {
        const ur = unit.getBoundingClientRect();
        const cr = control.getBoundingClientRect();
        if (!inside(ur, cr)) problems.push(`${label}: unit is outside its value control`);
        if (!inside(ur, rr)) problems.push(`${label}: unit is outside its field row`);
      }
      for (const cue of row.querySelectorAll<HTMLElement>('.ui-field-dq-btn, .winisd-deviation-cue')) {
        if (!cue.getClientRects().length) continue;
        const qr = cue.getBoundingClientRect();
        if (!inside(qr, rr)) problems.push(`${label}: ${cue.className} is outside its field row`);
        if (control) {
          // Some readouts deliberately place ≠W inside the value box. Guard the digits/text area,
          // not the whole box: reserved right padding is where the adornment belongs.
          let textRect: DOMRect;
          if (control.matches('input, select, textarea')) {
            const cr = control.getBoundingClientRect(), css = getComputedStyle(control);
            const left = cr.left + parseFloat(css.paddingLeft || '0');
            const right = cr.right - parseFloat(css.paddingRight || '0');
            textRect = new DOMRect(left, cr.top, Math.max(0, right - left), cr.height);
          } else {
            const range = document.createRange();
            range.selectNodeContents(control);
            textRect = range.getBoundingClientRect();
          }
          if (qr.left < textRect.right - 0.5 && qr.right > textRect.left + 0.5 && qr.top < textRect.bottom - 0.5 && qr.bottom > textRect.top + 0.5) {
            problems.push(`${label}: ${cue.className} overlaps the displayed value`);
          }
        }
        if (hasUnit && unit) {
          const ur = unit.getBoundingClientRect();
          if (qr.left < ur.right - 0.5 && qr.right > ur.left + 0.5 && qr.top < ur.bottom - 0.5 && qr.bottom > ur.top + 0.5) {
            problems.push(`${label}: ${cue.className} overlaps the unit`);
          }
        }
      }
      const cues = [...row.querySelectorAll<HTMLElement>('.ui-field-dq-btn, .winisd-deviation-cue')].filter(cue => cue.getClientRects().length > 0);
      for (let i = 0; i < cues.length; i++) for (let j = i + 1; j < cues.length; j++) {
        const a = cues[i]!.getBoundingClientRect(), b = cues[j]!.getBoundingClientRect();
        if (a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5) {
          problems.push(`${label}: ${cues[i]!.className} overlaps ${cues[j]!.className}`);
        }
      }
      return problems;
    }));
    expect(misplaced, `phone unit/control and warning/WinISD cue placement on ${screen.name}`).toEqual([]);
  });
}
