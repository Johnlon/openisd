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
  for (const group of root.querySelectorAll('.box-fields-col')) {
    const header = group.querySelector('.section-header');
    if (header === null) throw new Error('Field group requires a visible section heading');
    const frame = header.getBoundingClientRect();
    for (const control of [...group.querySelectorAll('input,select,button,[role="button"]')].filter(visible)) {
      const box = control.getBoundingClientRect();
      if (box.left < frame.left || box.right > frame.right) issues.push(`${header.textContent?.trim()}: control ${control.getAttribute('title') ?? control.textContent?.trim()} leaves its heading bounds`);
    }
  }
  return issues;
}
