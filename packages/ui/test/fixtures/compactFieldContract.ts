export interface IntrinsicNumber {
  readonly key: string;
  readonly count: boolean;
  readonly options: readonly string[];
  readonly hasUnits: boolean;
}

export interface ApprovedGeometry {field:string;specimen:string|null;valueWidth:number;rowHeight:number;rowWidth:number;unit:{leftFromValueRight:number;rightFromValueRight:number;topFromValueTop:number;height:number}|null}
/** Joined geometry from the frozen approved preview. Completeness/access use measureFieldInventory. */
export function measureCompactFields(root: Element, reference: {intrinsic:readonly IntrinsicNumber[];geometry:readonly ApprovedGeometry[]}) {
  const {intrinsic,geometry}=reference;
  const document = root.ownerDocument;
  const view = document.defaultView;
  if (view === null) throw new Error('Compact field measurement needs a live document');
  const getComputedStyle = view.getComputedStyle.bind(view);
  const issues: string[] = [];
  const wraps: string[] = [];
  const rows = [...root.querySelectorAll<HTMLElement>('.ui-field[data-field], .mob-sheet-cell[data-field]')].filter(row=>row.checkVisibility());
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('No text measurement context');
  const visible = (element: Element) => element.checkVisibility({visibilityProperty: true, opacityProperty: true});
  let measured = 0;
  if(rows.length!==geometry.length)issues.push(`numeric row count ${rows.length}, expected ${geometry.length}`);
  for (const [index,row] of rows.entries()) {
    const key = row.dataset.field ?? '';
    const approved=geometry[index];
    const expected = intrinsic.find(field => field.key === key);
    const label = row.querySelector('label,.mob-sheet-label')?.textContent?.trim() ?? key;
    const fail = (message: string) => issues.push(`${label}: ${message}`);
    if(!approved){fail('missing approved geometry');continue;}
    if(approved.field!==key)fail(`field identity ${key}, expected ${approved.field}`);
    if(approved.specimen!==null&&row.closest('[data-specimen]')?.getAttribute('data-specimen')!==approved.specimen)fail('catalogue specimen order/identity differs');
    if (!expected) { fail('unknown semantic field'); continue; }
    const value = row.querySelector<HTMLInputElement | HTMLSelectElement | HTMLElement>('.ui-field-value input,.ui-field-value select,.ui-field-value .mob-readonly,.mob-sheet-value input,.mob-sheet-value select');
    if (value === null) { fail('missing native value control'); continue; }
    measured++;
    const readonly = row.dataset.access === 'readonly';
    if (expected.count && !readonly) {
      if (!(value instanceof HTMLSelectElement)) fail('count requires a select');
      else if (JSON.stringify([...value.options].map(option => option.value)) !== JSON.stringify(expected.options)) fail('count options differ from intrinsic limits');
      if (row.querySelector('.num-stepper')) fail('count must not have numeric spinners');
    } else if (!(value instanceof HTMLInputElement) && !value.classList.contains('mob-readonly')) fail('number requires a numeric input or readout');
    if (value instanceof HTMLInputElement && value.readOnly !== readonly) fail('native readonly does not match binding access');
    const box = value.getBoundingClientRect();
    const rowBox = row.getBoundingClientRect();
    if (Math.abs(box.width-approved.valueWidth)>0.5)fail(`value width ${box.width}, expected ${approved.valueWidth}`);
    if (box.left < rowBox.left || box.right > rowBox.right + 0.5) fail('value leaves the row');
    if (!row.classList.contains('ui-field-note-open') && Math.abs(rowBox.height-approved.rowHeight)>0.5)fail(`row depth ${rowBox.height}, expected ${approved.rowHeight}`);
    const style = getComputedStyle(value);
    if (parseFloat(style.borderLeftWidth) < 1 || style.borderLeftStyle === 'none' || style.borderLeftColor === 'rgba(0, 0, 0, 0)') fail('border missing');
    const unit = row.querySelector<HTMLElement>('.ui-field-unit,.mob-sheet-unit');
    const unitVisible = unit !== null && visible(unit) && (unit.textContent?.trim() ?? '') !== '';
    if (expected.hasUnits !== unitVisible) fail('unit presence differs from intrinsic field');
    if(unitVisible&&unit!==null){
      const actual=unit.getBoundingClientRect(),wanted=approved.unit;
      if(wanted===null)fail('unit has no approved geometry');
      else if(Math.abs(actual.left-box.right-wanted.leftFromValueRight)>0.5||Math.abs(actual.right-box.right-wanted.rightFromValueRight)>0.5||Math.abs(actual.top-box.top-wanted.topFromValueTop)>0.5||Math.abs(actual.height-wanted.height)>0.5)fail('joined unit/value edges differ from the approved reference');
    }
    const dq = row.querySelector<HTMLElement>('.ui-field-dq-btn');
    if (dq !== null && visible(dq) && dq.getBoundingClientRect().right > box.left + 0.5) fail('warning must sit outside left');
    const dev = row.querySelector<HTMLElement>('.winisd-deviation-cue');
    if (dev !== null && visible(dev)) {
      const controls = [value, ...row.querySelectorAll<HTMLElement>('.num-stepper-btn')];
      if (unitVisible && unit !== null) controls.push(unit);
      const edge = Math.max(...controls.map(control => control.getBoundingClientRect().right));
      const gap = dev.getBoundingClientRect().left - edge;
      if (gap < -0.5 || gap > 6) fail(`model cue must follow the last control by 0–6px (gap ${gap})`);
    }
    const completeControl = [value, ...row.querySelectorAll<HTMLElement>('.ui-field-unit,.mob-sheet-unit,.ui-field-dq-btn,.num-stepper-btn,.winisd-deviation-cue')];
    for (const part of completeControl.filter(visible)) {
      const edge = part.getBoundingClientRect();
      if (edge.width === 0 || edge.height === 0) continue;
      if (edge.left < rowBox.left || edge.right > rowBox.right || edge.top < rowBox.top || edge.bottom > rowBox.bottom) {
        fail(`control leaves its row: ${part.getAttribute('title') ?? part.textContent?.trim() ?? part.tagName}`);
      }
    }
    context.font = style.font;
    const text = value instanceof HTMLInputElement ? value.value : value instanceof HTMLSelectElement ? value.selectedOptions[0]?.textContent ?? '' : value.textContent ?? '';
    const content = box.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth);
    if (context.measureText(text).width > content + 0.5) fail('numeric text is clipped');
    const labelElement = row.querySelector('label,.mob-sheet-label');
    if (labelElement !== null) {
      const labelStyle = getComputedStyle(labelElement);
      if (labelElement.getBoundingClientRect().height > parseFloat(labelStyle.lineHeight) + 1) wraps.push(label);
    }
  }
  return {rows: rows.length, measured, issues, wraps};
}
