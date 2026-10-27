/** Measurements of the rendered field, independent of its chosen layout or CSS variables. */
export interface FieldVisualIssue {
  readonly field: string;
  readonly problem: string;
}

export interface FieldVisualReport {
  readonly rows: number;
  readonly controls: number;
  readonly issues: readonly FieldVisualIssue[];
}

/** Runs in the browser. Inputs have no DOM text nodes: measure their actual value using their
 * computed font, alignment, direction and scroll offset. Ordinary text uses browser Ranges.
 * A chip may intentionally live inside an input box; it must never cover the value's glyphs.
 */
export async function measureFieldContent(root: Element): Promise<FieldVisualReport> {
  const document = root.ownerDocument;
  await document.fonts.ready;
  const view = document.defaultView;
  if (view === null) throw new Error('Field measurement needs a live document');
  const getComputedStyle = view.getComputedStyle.bind(view);
  const issues: FieldVisualIssue[] = [];
  const visible = (el: Element): boolean => el.checkVisibility({visibilityProperty: true, opacityProperty: true});
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('Field measurement needs a canvas text context');
  const rows = [...root.querySelectorAll<HTMLElement>('.ui-field, .de-fld:not(.ui-field)')].filter(visible);
  let controls = 0;
  const intersects = (a: DOMRect, b: DOMRect): boolean => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5
    && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
  const desktopUnits = new Map<string, number>();
  for (const row of rows) {
    const field = row.querySelector('label')?.textContent?.trim() || row.id || '(unlabelled field)';
    const value = row.querySelector<HTMLElement>('.ui-field-value input, .ui-field-value select, .ui-field-value textarea, .ui-field-value .mob-readonly, .ui-field-value .calculated, :scope > input, :scope > select, :scope > textarea');
    if (value === null || !visible(value)) {
      issues.push({field, problem: 'field has no visible recognised value control'});
      continue;
    }
    controls++;
    // Joined caps and spinners must follow the complete input outline. Text clearance alone
    // misses a wide input painted underneath its cap or buttons (Cms and other wide units).
    if (row.closest('.joined-fields') !== null && value instanceof HTMLInputElement) {
      const box = value.getBoundingClientRect();
      const unit = row.querySelector<HTMLElement>('.ui-field-unit');
      if (unit !== null && visible(unit) && unit.textContent?.trim()
        && Math.abs(unit.getBoundingClientRect().right - box.right) > 0.5) {
        issues.push({field, problem: 'unit does not end at the complete input outline'});
      }
      for (const spinner of row.querySelectorAll<HTMLElement>('.num-stepper-btn')) {
        if (visible(spinner) && intersects(box, spinner.getBoundingClientRect())) {
          issues.push({field, problem: 'spinner overlaps the complete input outline'});
        }
      }
    }
    let text: DOMRect;
    if (value instanceof HTMLInputElement || value instanceof HTMLSelectElement || value instanceof HTMLTextAreaElement) {
      const css = getComputedStyle(value);
      // Independent production reference: phone Driver readouts were measured as Inter,
      // 15px, normal 400, 22.5px line height. Check EVERY readonly numeric input, not
      // whichever happens to be first; geometry alone accepts the wrong typeface.
      if (value instanceof HTMLInputElement && value.readOnly && value.closest('.app-root-mobile') !== null) {
        const expected: Record<string, string> = {
          'font-family': 'Inter, system-ui, sans-serif', 'font-size': '15px',
          'font-weight': '400', 'font-style': 'normal', 'line-height': '22.5px',
          'letter-spacing': 'normal',
        };
        const differences = Object.entries(expected).flatMap(([property, wanted]) => {
          const actual = css.getPropertyValue(property);
          return actual === wanted ? [] : [`${property}: ${actual}, expected ${wanted}`];
        });
        if (differences.length > 0) issues.push({field, problem: 'readout typography differs: ' + differences.join('; ')});
        // A computed family string survives removal/failure of the actual font resource.
        // Require a loaded regular face covering digits as well as FontFaceSet.check;
        // check() by itself returns true even when the named family was never declared.
        const digitsLoaded = [...document.fonts].some(face =>
          face.family.replace(/["']/g, '') === 'Inter' && face.weight === '400'
          && face.style === 'normal' && face.status === 'loaded'
          && face.unicodeRange.split(',').some(range => {
            const match = /^U\+([0-9A-F]+)(?:-([0-9A-F]+))?$/i.exec(range.trim());
            return match !== null && parseInt(match[1],16) <= 0x30 && parseInt(match[2] ?? match[1],16) >= 0x39;
          }));
        if (!digitsLoaded || !document.fonts.check('400 15px Inter','0123456789')) {
          issues.push({field, problem: 'readout font unavailable: loaded regular Inter digits required; fallback is not accepted'});
        }
      }
      const box = value.getBoundingClientRect();
      const contentLeft = box.left + parseFloat(css.borderLeftWidth) + parseFloat(css.paddingLeft);
      const contentRight = box.right - parseFloat(css.borderRightWidth) - parseFloat(css.paddingRight);
      const shown = value instanceof HTMLSelectElement ? value.selectedOptions[0]?.textContent ?? '' : value.value;
      ctx.font = css.font;
      const metrics = ctx.measureText(shown);
      const spacing = parseFloat(css.letterSpacing) || 0;
      const width = metrics.width + Math.max(0, shown.length - 1) * spacing;
      const alignRight = css.textAlign === 'right' || (css.textAlign === 'end' && css.direction !== 'rtl')
        || (css.textAlign === 'start' && css.direction === 'rtl');
      const x = (css.textAlign === 'center' ? (contentLeft + contentRight - width) / 2 : alignRight ? contentRight - width : contentLeft) - value.scrollLeft;
      // Free-form names and multiline notes are native scrolling/wrapping editors.
      // Display-precision numeric values must fit without horizontal scrolling.
      const numeric = value instanceof HTMLInputElement && (value.closest('.num-input-wrap') !== null || value.classList.contains('calculated'));
      if (numeric && width > contentRight - contentLeft + 1) {
        issues.push({field, problem: `displayed value is clipped: text ${width.toFixed(2)}px, content ${(contentRight - contentLeft).toFixed(2)}px`});
      }
      const height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
      const contentTop = box.top + parseFloat(css.borderTopWidth) + parseFloat(css.paddingTop);
      const contentBottom = box.bottom - parseFloat(css.borderBottomWidth) - parseFloat(css.paddingBottom);
      text = new DOMRect(x, (contentTop + contentBottom - height) / 2, width, height);
    } else {
      const range = document.createRange();
      range.selectNodeContents(value);
      text = range.getBoundingClientRect();
    }
    const label = row.querySelector('label');
    if (label !== null && visible(label)) {
      const labelRange = document.createRange();
      labelRange.selectNodeContents(label);
      const warning = row.querySelector('.ui-field-dq-btn');
      const rowBox = row.getBoundingClientRect();
      for (const glyphs of labelRange.getClientRects()) {
        if (warning !== null && intersects(glyphs, warning.getBoundingClientRect())) issues.push({field, problem:'label overlaps warning'});
        if (intersects(glyphs, value.getBoundingClientRect())) issues.push({field, problem:'label overlaps value control'});
        if (glyphs.top < rowBox.top - 0.5 || glyphs.bottom > rowBox.bottom + 0.5) issues.push({field, problem:'label extends beyond its row'});
      }
    }
    for (const adornment of row.querySelectorAll<HTMLElement>('.ui-field-unit, .ui-field-dq-btn, .winisd-deviation-cue, .num-stepper-btn')) {
      if (!visible(adornment) || adornment.textContent?.trim() === '') continue;
      const obstacle = adornment.getBoundingClientRect();
      if (adornment.classList.contains('winisd-deviation-cue')) {
        const groupParts = [value, ...row.querySelectorAll<HTMLElement>('.ui-field-unit, .num-stepper')].filter(visible);
        const right = Math.max(...groupParts.map(part => part.getBoundingClientRect().right));
        if (obstacle.left < right - 0.5) issues.push({field, problem: 'model cue is inside the value/unit/spinner control group'});
      }

      if (text.width > 0 && adornment.classList.contains('winisd-deviation-cue')
        && obstacle.left >= text.right && obstacle.left - text.right < 3.5) {
        issues.push({field, problem: 'displayed value has less than 4px clearance from the model cue'});
      }
      if (intersects(text, obstacle)) {
        issues.push({field, problem: `displayed value overlaps ${adornment.className}: text ${text.left.toFixed(2)}–${text.right.toFixed(2)}, control ${obstacle.left.toFixed(2)}–${obstacle.right.toFixed(2)}`});
      }
    }
    const adornments = [...row.querySelectorAll<HTMLElement>('.ui-field-unit, .ui-field-dq-btn, .winisd-deviation-cue, .num-stepper-btn')]
      .filter(el => visible(el) && el.textContent?.trim() !== '');
    for (let i = 0; i < adornments.length; i++) {
      const a = adornments[i]!;
      for (const b of adornments.slice(i + 1)) {
        if (intersects(a.getBoundingClientRect(), b.getBoundingClientRect())) issues.push({field, problem: `${a.className} overlaps ${b.className}`});
      }
    }
    const unit = row.querySelector<HTMLElement>('.ui-field-unit');
    if (unit && visible(unit) && unit.textContent?.trim()) {
      const range = document.createRange();
      range.selectNodeContents(unit);
      const glyphs = range.getBoundingClientRect(), box = unit.getBoundingClientRect();
      if (row.closest('.joined-fields') && !row.closest('.app-root-mobile') && !unit.classList.contains('unit-toggle')) {
        const edge = value.getBoundingClientRect().right - parseFloat(getComputedStyle(value).borderRightWidth);
        if (glyphs.right > edge - 2.5) issues.push({field, problem: 'fixed unit text touches the input right border'});
      }
      const minimumChip = parseFloat(getComputedStyle(row).getPropertyValue('--mob-col-chip-min'));
      if (row.closest('.app-root-mobile') && !unit.classList.contains('unit-toggle')
        && glyphs.width <= minimumChip + 0.5 && box.width > minimumChip + 0.5) {
        issues.push({field, problem: 'fixed unit is unnecessarily indented by a wider column'});
      }
      // A plain transparent label has no painted box. A clickable chip must contain its
      // glyphs; either kind must keep its actual text clear of neighbouring controls.
      if (unit.classList.contains('unit-toggle') && (glyphs.left < box.left - 0.5 || glyphs.right > box.right + 0.5)) issues.push({field, problem: 'unit text overflows its own control'});
      for (const other of adornments.filter(el => el !== unit)) {
        if (intersects(glyphs, other.getBoundingClientRect())) issues.push({field, problem: `unit text overlaps ${other.className}`});
      }
      if (unit.classList.contains('unit-toggle') && !row.closest('.app-root-mobile') && Math.abs(box.height - value.getBoundingClientRect().height) > 0.5) {
        issues.push({field, problem: 'desktop unit chip is not as tall as its value control'});
      }
      if (!unit.classList.contains('unit-toggle') && getComputedStyle(unit).backgroundColor !== 'rgba(0, 0, 0, 0)') {
        issues.push({field, problem: 'fixed unit paints an opaque patch instead of the underlying surface'});
      }
      if (unit.classList.contains('unit-toggle') && row.closest('.app-root-mobile') && parseFloat(getComputedStyle(unit).borderLeftWidth) < 1) {
        issues.push({field, problem: 'phone unit chip has lost its left divider'});
      }
    }
    if (unit?.classList.contains('unit-toggle') && visible(unit) && !row.closest('.app-root-mobile')) {
      const width = unit.getBoundingClientRect().width;
      const key = `${unit.textContent?.trim()}|${getComputedStyle(unit).font}`;
      const previous = desktopUnits.get(key);
      if (previous !== undefined && Math.abs(width - previous) > 0.5) issues.push({field, problem: 'identical unit chips have inconsistent widths'});
      desktopUnits.set(key, width);
      if (Math.abs(unit.getBoundingClientRect().top - value.getBoundingClientRect().top) > 0.5) issues.push({field, problem: 'unit chip is vertically offset from its value control'});
    }
    if (value instanceof HTMLInputElement) {
      const align = getComputedStyle(value).textAlign;
      if (align !== 'left' && align !== 'start') issues.push({field, problem: 'numeric field lost production left alignment'});
      const specified = value.computedStyleMap().get('width');
      if (specified && /^\d+(?:\.\d+)?px$/.test(String(specified)) && getComputedStyle(value).boxSizing === 'border-box'
        && value.getBoundingClientRect().width + 0.5 < parseFloat(String(specified))) {
        issues.push({field, problem: 'fixed-width value control is shrunk by its siblings'});
      }
    }
  }
  for (const link of root.querySelectorAll<HTMLElement>('.mob-clinks button, .mob-clinks a')) {
    if (visible(link) && parseFloat(getComputedStyle(link).fontSize) < 14) issues.push({field: link.textContent?.trim() ?? '(action link)', problem: 'phone action text is smaller than production 14px'});
  }
  for (const hint of root.querySelectorAll<HTMLElement>('.hint, .de-note, .ui-field-note')) {
    if (!visible(hint)) continue;
    const range = document.createRange();
    range.selectNodeContents(hint);
    for (let ancestor: Element | null = hint; ancestor !== null; ancestor = ancestor.parentElement) {
      if (/^(hidden|clip|auto|scroll)$/.test(getComputedStyle(ancestor).overflowX)) {
        const rect = ancestor.getBoundingClientRect();
        const left = rect.left + ancestor.clientLeft;
        const right = left + ancestor.clientWidth;
        if ([...range.getClientRects()].some(text => text.left < left - 0.5 || text.right > right + 0.5)) {
          issues.push({field: hint.textContent?.trim() ?? '(hint)', problem: 'explanatory text is clipped by its container'});
          break;
        }
      }
      if (ancestor === root) break;
    }
  }
  return {rows: rows.length, controls, issues};
}

/** A declared border can be painted over by a sibling. Scroll each control into view and
 * inspect the paint stack along all four straight edges, accepting a joined unit's own
 * border when it supplies that edge. Transparent wrappers do not obscure a border.
 */
export function measureFieldBorders(root: Element): FieldVisualReport {
  const document = root.ownerDocument;
  const view = document.defaultView;
  if (view === null) throw new Error('Border measurement needs a live document');
  const getComputedStyle = view.getComputedStyle.bind(view);
  const issues: FieldVisualIssue[] = [];
  const visible = (el: Element): boolean => el.checkVisibility({visibilityProperty: true, opacityProperty: true});
  const rows = [...root.querySelectorAll<HTMLElement>('.ui-field, .de-fld:not(.ui-field)')].filter(visible);
  const sides = ['top', 'right', 'bottom', 'left'] as const;
  const transparent = (color: string): boolean => color === 'transparent' || /rgba\([^)]*,\s*0\s*\)/.test(color);
  const borderAt = (el: Element, x: number, y: number): boolean => {
    const css = getComputedStyle(el), r = el.getBoundingClientRect();
    return sides.some(side => {
      const width = parseFloat(css.getPropertyValue(`border-${side}-width`));
      const style = css.getPropertyValue(`border-${side}-style`);
      const distance = side === 'top' ? y - r.top : side === 'bottom' ? r.bottom - y : side === 'left' ? x - r.left : r.right - x;
      return width > 0 && style !== 'none' && style !== 'hidden' && !transparent(css.getPropertyValue(`border-${side}-color`))
        && distance >= 0 && distance < width;
    });
  };
  let controls = 0;
  for (const row of rows) {
    const field = row.querySelector('label')?.textContent?.trim() || row.id || '(unlabelled field)';
    const value = row.querySelector<HTMLElement>('.ui-field-value input, .ui-field-value select, .ui-field-value textarea, .ui-field-value .mob-readonly, .ui-field-value .calculated, :scope > input, :scope > select, :scope > textarea');
    if (value === null || !visible(value)) {
      issues.push({field, problem: 'field has no visible recognised value control'});
      continue;
    }
    controls++;
    value.scrollIntoView({block: 'nearest', inline: 'nearest'});
    const box = value.getBoundingClientRect(), css = getComputedStyle(value);
    if (value.classList.contains('de-input-mandatory') && !value.matches('.de-input-empty, .inp-bad, .dq-flag') && row.closest('.de-desktop')
      && (parseFloat(css.borderTopWidth) < 2 || css.borderTopColor !== 'rgb(118, 118, 118)')) {
      issues.push({field, problem: 'desktop mandatory border lost its production thickness or contrast'});
    }
    for (const side of sides) {
      const width = parseFloat(css.getPropertyValue(`border-${side}-width`));
      const style = css.getPropertyValue(`border-${side}-style`);
      if (width < 1 || style === 'none' || style === 'hidden' || transparent(css.getPropertyValue(`border-${side}-color`))) {
        issues.push({field, problem: `${side} border is missing`});
        continue;
      }
      const horizontal = side === 'top' || side === 'bottom';
      const length = horizontal ? box.width : box.height;
      // Stay clear of rounded corners; sample the straight perimeter every four CSS pixels.
      const inset = Math.min(6, length / 4);
      for (let offset = inset; offset < length - inset; offset += 4) {
        const x = horizontal ? box.left + offset : side === 'left' ? box.left + width / 2 : box.right - width / 2;
        const y = horizontal ? side === 'top' ? box.top + width / 2 : box.bottom - width / 2 : box.top + offset;
        let painted = false;
        let covering = 'viewport or clipping ancestor';
        for (const layer of document.elementsFromPoint(x, y)) {
          // Hit testing rounds fractional boundaries and may return an adjacent chip whose
          // actual rectangle starts half a pixel beyond this point. It cannot paint here.
          const rect = layer.getBoundingClientRect();
          if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) continue;
          if (layer === value) { painted = true; break; }
          if (layer.contains(value)) continue;
          if (borderAt(layer, x, y)) {
            if (layer.matches('.ui-field-unit.unit-toggle') && (horizontal || side === 'right')) {
              const coveringCss = getComputedStyle(layer);
              if (coveringCss.getPropertyValue(`border-${side}-width`) !== css.getPropertyValue(`border-${side}-width`)
                || coveringCss.getPropertyValue(`border-${side}-color`) !== css.getPropertyValue(`border-${side}-color`)) {
                issues.push({field, problem: `${side} border changes thickness or colour beneath its unit`});
              }
            }
            painted = true;
            break;
          }
          const background = getComputedStyle(layer).backgroundColor;
          if (!transparent(background)) { covering = `${layer.tagName.toLowerCase()}.${layer.className}`; break; }
        }
        if (!painted) {
          issues.push({field, problem: `${side} border is covered by ${covering}`});
          break;
        }
      }
    }
  }
  return {rows: rows.length, controls, issues};
}

/** Read-only specification tables use plain text rather than UIField inputs. Measure glyphs,
 * including the unitless numeric rows, instead of treating their grid cells as their text. */
export function measureSummaryContent(root: Element): FieldVisualReport {
  const document = root.ownerDocument;
  const issues: FieldVisualIssue[] = [];
  const rows = [...root.querySelectorAll<HTMLElement>('.spec-row')].filter(row => row.checkVisibility());
  const columns = new Map<number, {right: number[]; unit: number[]}>();
  const glyphs = (element: Element): DOMRect => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return range.getBoundingClientRect();
  };
  let controls = 0;
  for (const row of rows) {
    const field = row.querySelector('.spec-lbl')?.textContent?.trim() ?? '(summary field)';
    const value = row.querySelector('.spec-val b');
    const label = row.querySelector('.spec-lbl');
    if (value === null || label === null) {
      issues.push({field, problem: 'summary row has no recognised label/value'});
      continue;
    }
    controls++;
    const text = glyphs(value), labelText = glyphs(label), box = row.getBoundingClientRect();
    if (labelText.right > text.left - 1) issues.push({field, problem: 'summary label and value glyphs overlap'});
    if (text.right > box.right + 0.5 || text.left < box.left - 0.5) issues.push({field, problem: 'summary value extends outside its row'});
    const unit = row.querySelector('.spec-unit');
    const numeric = value.textContent?.trim() !== '' && Number.isFinite(Number(value.textContent));
    const column = columns.get(Math.round(box.left)) ?? {right: [], unit: []};
    columns.set(Math.round(box.left), column);
    if (numeric) column.right.push(text.right);
    if (unit?.textContent?.trim()) {
      const unitText = glyphs(unit);
      const unitBox = unit.getBoundingClientRect();
      column.unit.push(unitText.left);
      if (unitText.left - text.right < 3.5) issues.push({field, problem: 'summary value has less than 4px separation from its unit'});
      if (unitText.left < unitBox.left - 0.5 || unitText.right > unitBox.right + 0.5 || unitText.right > box.right + 0.5) issues.push({field, problem: 'summary unit text overflows its column'});
    }
  }
  const drift = (values: number[]): number => values.length === 0 ? 0 : Math.max(...values) - Math.min(...values);
  for (const [left, column] of columns) {
    if (drift(column.right) > 1) issues.push({field: `summary column at ${left}px`, problem: 'numeric glyphs do not share a right edge'});
    if (drift(column.unit) > 1) issues.push({field: `summary column at ${left}px`, problem: 'unit glyphs do not share a left edge'});
  }
  return {rows: rows.length, controls, issues};
}
