/** Measures actual control edges against every ancestor that can clip them. No field CSS assumptions. */
export function measureFieldControlContainment(root: Element) {
  const issues: string[] = [];
  const document = root.ownerDocument;
  const view = document.defaultView;
  if (view === null) throw new Error('Control containment requires a live document');
  const controls = [...root.querySelectorAll<HTMLElement>('.ui-field input,.ui-field select,.ui-field textarea,.ui-field .ui-field-unit,.ui-field .num-stepper-btn,.ui-field .winisd-deviation-cue')]
    .filter(element => element.checkVisibility({visibilityProperty: true, opacityProperty: true}) && element.getBoundingClientRect().width > 0);
  for (const control of controls) {
    const field = control.closest('.ui-field');
    const label = field?.getAttribute('data-field') ?? field?.querySelector('label')?.textContent ?? '(unlabelled field)';
    const box = control.getBoundingClientRect();
    const name = control.getAttribute('title') ?? control.getAttribute('aria-label') ?? control.textContent?.trim() ?? control.tagName;
    if (box.left < 0 || box.right > view.innerWidth) issues.push(`${label} ${name}: leaves the viewport`);
    for (let ancestor = control.parentElement; ancestor !== null; ancestor = ancestor.parentElement) {
      const style = view.getComputedStyle(ancestor);
      if (!/^(hidden|clip|auto|scroll)$/.test(style.overflowX)) continue;
      const frame = ancestor.getBoundingClientRect();
      const left = frame.left + ancestor.clientLeft;
      const right = left + ancestor.clientWidth;
      if (box.left < left || box.right > right) issues.push(`${label} ${name}: clipped by ${ancestor.className}`);
    }
  }
  return {controls: controls.length, issues};
}

/** Field groups also own adjacent actions and diagrams; checking only an input misses these collisions. */
export function measureFieldGroupContent(root: Element) {
  const issues: string[] = [];
  const visible = (element: Element) => element.checkVisibility({visibilityProperty: true, opacityProperty: true});
  const diagrams = [...root.querySelectorAll('svg')].filter(visible);
  const actions = [...root.querySelectorAll('a,button.link-btn')].filter(visible);
  for (const action of actions) {
    const text = root.ownerDocument.createRange();
    text.selectNodeContents(action);
    const box = text.getBoundingClientRect();
    for (const diagram of diagrams) {
      if (action.contains(diagram)) continue;
      const shape = diagram.getBoundingClientRect();
      if (Math.min(box.right, shape.right) > Math.max(box.left, shape.left) && Math.min(box.bottom, shape.bottom) > Math.max(box.top, shape.top)) {
        issues.push(`${action.textContent?.trim()}: overlaps a diagram`);
      }
    }
  }
  for (const group of root.querySelectorAll('.box-fields-col,.pr-controls > div,.vent-col')) {
    const header = group.querySelector('.section-header,.vent-col-title');
    if (header === null) throw new Error('Field group requires a visible section heading');
    const frame = header.getBoundingClientRect();
    for (const control of [...group.querySelectorAll('input,select,button,[role="button"],.winisd-deviation-cue')].filter(visible)) {
      const box = control.getBoundingClientRect();
      if (box.left < frame.left || box.right > frame.right) issues.push(`${header.textContent?.trim()}: control ${control.getAttribute('title') ?? control.textContent?.trim()} leaves its heading bounds`);
    }
  }
  return issues;
}

/** Layout columns must contain their painted descendants even when overflow is visible. */
export function measureFieldLayoutRegions(root: Element) {
  const issues: string[] = [];
  const visible = (node: Element) => node.checkVisibility({visibilityProperty:true,opacityProperty:true}) && node.getBoundingClientRect().width > 0;
  for (const field of [...root.querySelectorAll('.ui-field')].filter(visible)) {
    const frame = field.getBoundingClientRect(), name = field.querySelector('label')?.textContent?.trim() ?? 'field';
    for (const control of [...field.querySelectorAll('input,select,textarea,.num-stepper-btn,.winisd-deviation-cue')].filter(visible)) {
      const box = control.getBoundingClientRect();
      if (box.left < frame.left-0.5 || box.right > frame.right+0.5) issues.push(name+': painted control escapes its field');
    }
  }
  const selectors = '.field input,.field select,.field .num-stepper-btn,.field label,.hint,.box-diagram-col svg';
  const pieces = [...root.querySelectorAll(selectors)].filter(visible).flatMap(element => {
    const owner = element.closest('.field,.hint,.box-diagram-col') ?? element;
    if (element.matches('label,.hint')) {
      const range = root.ownerDocument.createRange();range.selectNodeContents(element);
      return [...range.getClientRects()].filter(box => box.width > 0).map(box => ({owner,box,name:element.textContent?.trim().slice(0,45) ?? ''}));
    }
    return [{owner,box:element.getBoundingClientRect(),name:element.getAttribute('aria-label') ?? element.getAttribute('id') ?? element.tagName}];
  });
  for (let i=0;i<pieces.length;i++) for (let j=i+1;j<pieces.length;j++) {
    const a=pieces[i],b=pieces[j];if (a.owner===b.owner || a.owner.contains(b.owner) || b.owner.contains(a.owner)) continue;
    if (Math.min(a.box.right,b.box.right)-Math.max(a.box.left,b.box.left)>1 && Math.min(a.box.bottom,b.box.bottom)-Math.max(a.box.top,b.box.top)>1) issues.push(a.name+' overlaps '+b.name);
  }
  return {fields:[...root.querySelectorAll('.ui-field')].filter(visible).length,issues};
}
