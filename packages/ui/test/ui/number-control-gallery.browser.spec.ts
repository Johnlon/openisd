import {expect, test} from '../fixtures.js';
import {FIELD_APPEARANCES, FieldAccess, FieldEditor} from '@openisd/design/fields';
import {approvedCataloguePaint} from '../fixtures/approvedPaintReference.js';

test.use({isMobile:true,hasTouch:true,viewport:{width:374,height:400}});

for (const form of FIELD_APPEARANCES.filter(form => form.editor === FieldEditor.Number && form.access === FieldAccess.Writable && form.stepper)) {
  test(`${form.id}: gallery spinner stays under the finger through keyboard dismissal`, async ({page}) => {
    await page.goto('/?field-catalogue=1');
    const row = page.locator(`[data-specimen="${form.id}"]`);
    const input = row.locator('input');
    await input.focus();
    await input.evaluate(el => el.scrollIntoView({block:'center'}));
    const before = await input.evaluate(el => el.getBoundingClientRect().top);
    await input.blur();
    await row.locator('.num-stepper-btn').first().tap();
    await page.setViewportSize({width:374,height:705});
    await page.locator('.field-catalogue').evaluate(el => {el.scrollTop -= 150;});
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const after = await input.evaluate(el => el.getBoundingClientRect().top);
    expect(Math.abs(after-before)).toBeLessThan(1);
  });
}

for (const width of [360, 374, 412]) {
  test(`every gallery family keeps its label, value and cues aligned at ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:705});
    await page.goto('/?field-catalogue=1');
    const report = await page.locator('.field-catalogue').evaluate((root, numericFonts) => {
      const issues: string[] = [];
      const rows = [...root.querySelectorAll<HTMLElement>('[data-specimen]')];
      const first = root.querySelector<HTMLInputElement>('[data-specimen="number-writable-none-none"] input');
      if (first === null) throw new Error('Missing numeric reference');
      const left = first.getBoundingClientRect().left;
      for (const specimen of rows) {
        const name = specimen.dataset.specimen ?? 'unknown';
        const label = specimen.querySelector('label');
        const control = specimen.querySelector('input,select,textarea,meter,[role="checkbox"],.catalogue-colour-readout');
        if (label === null || control === null) throw new Error('Incomplete specimen '+name);
        const range = document.createRange(); range.selectNodeContents(label);
        if (new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size !== 1) issues.push(name+': label wraps');
        const box = control.getBoundingClientRect();
        if (control.matches('input:not([type=checkbox],[type=range],[type=color]), select, textarea')) {
          const paint = getComputedStyle(control);
          const font = numericFonts[name] ?? {fontSize:'15px',fontFamily:'Arial, sans-serif'};
          if (paint.fontSize !== font.fontSize || paint.fontFamily !== font.fontFamily) issues.push(name+': text control typography differs');
          if ([paint.borderTopWidth,paint.borderRightWidth,paint.borderBottomWidth,paint.borderLeftWidth].some(width => parseFloat(width) < 1)) issues.push(name+': control border is missing');
        }
        if (Math.abs(box.left-left)>0.5) issues.push(name+': value column is horizontally offset');
        const warning = specimen.querySelector('.ui-field-dq-btn')?.getBoundingClientRect();
        if (warning !== undefined && warning.right > box.left) issues.push(name+': warning is inside the value control');
        const parts = [box, ...[...specimen.querySelectorAll('.num-stepper-btn,.ui-field-unit')].filter(element => element.checkVisibility() && element.textContent?.trim()).map(element => element.getBoundingClientRect())];
        const model = specimen.querySelector('.winisd-deviation-cue')?.getBoundingClientRect();
        const groupRight = Math.max(...parts.map(rect => rect.right));
        if (model !== undefined && model.left < groupRight) issues.push(name+': model cue is inside the control group');
        if (model !== undefined && model.left-groupRight > 6) issues.push(name+': model cue is detached from its control');
        const unit = specimen.querySelector('.ui-field-unit');
        if (unit !== null && unit.checkVisibility() && unit.textContent?.trim()) {
          const style = getComputedStyle(control);
          const contentRight = box.right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth);
          if (contentRight > unit.getBoundingClientRect().left + 0.5) issues.push(name+': unit covers the control content');
        }
        const row = specimen.querySelector('.ui-field')?.getBoundingClientRect();
        if (row === undefined || box.right > row.right || (model !== undefined && model.right > row.right)) issues.push(name+': control group escapes its row');
      }
      return {rows:rows.length,issues};
    }, Object.fromEntries(FIELD_APPEARANCES.filter(form => form.editor === FieldEditor.Number || form.editor === FieldEditor.Count).map(form => {
      const control = approvedCataloguePaint(form.id).control;
      return [form.id, {fontSize:String(control.fontSize),fontFamily:String(control.fontFamily)}];
    })));
    expect(report.rows).toBe(FIELD_APPEARANCES.length);
    expect(report.issues).toEqual([]);
  });
}
