/**
 * The whole-screen measure (T763, process control "one view list the layout check walks"). Runs inside
 * the page on what is painted in `root`: nothing outside the window, no sideways scroll, no text cut,
 * no two visible controls overlapping. `measured` counts the controls and text elements looked at, so a
 * view that measured nothing can fail instead of passing empty. A fault is one line naming the rule.
 */
export interface WholeScreenResult {readonly issues: string[]; readonly measured: number}

export function measureWholeScreen(root: Element): WholeScreenResult {
  const issues: string[] = [];
  const doc = root.ownerDocument;
  const view = doc.defaultView;
  if (view === null) throw new Error('The whole-screen measure needs a live document');
  const shown = (el: Element) => el.checkVisibility({visibilityProperty: true, opacityProperty: true}) && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
  const name = (el: Element) => `${el.tagName.toLowerCase()}${el.id === '' ? '' : '#' + el.id}${typeof el.className === 'string' && el.className !== '' ? '.' + el.className.split(' ')[0] : ''}`;
  const label = (el: Element) => (el.textContent ?? '').trim().slice(0, 14);
  const everything = [root, ...root.querySelectorAll('*')].filter(shown);
  const controls = everything.filter(el => el.matches('button,a[href],input:not([type=hidden]),select,textarea,[role=button],[role=tab],[role=menuitem],label'));
  const texts = everything.filter(el => [...el.childNodes].some(node => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== ''));
  const measured = new Set([...controls, ...texts]).size;

  // The painted part of a box: cut to the frame of every ancestor that clips or scrolls it.
  const painted = (part: Element) => {
    const box = part.getBoundingClientRect();
    let {left, right, top, bottom} = box;
    for (let ancestor = part.parentElement; ancestor !== null && ancestor !== doc.documentElement; ancestor = ancestor.parentElement) {
      const style = view.getComputedStyle(ancestor);
      const frame = ancestor.getBoundingClientRect();
      if (/^(auto|scroll|hidden|clip)$/.test(style.overflowX)) { left = Math.max(left, frame.left); right = Math.min(right, frame.right); }
      if (/^(auto|scroll|hidden|clip)$/.test(style.overflowY)) { top = Math.max(top, frame.top); bottom = Math.min(bottom, frame.bottom); }
    }
    return {left, right, top, bottom};
  };

  // W1: no painted part leaves the window sideways.
  for (const part of new Set([...controls, ...texts])) {
    const box = painted(part);
    if (box.right - box.left <= 0) continue;
    if (box.left < -0.5 || box.right > view.innerWidth + 0.5) issues.push(`W1 ${name(part)} "${label(part)}" leaves the window sideways (${Math.round(box.left)}..${Math.round(box.right)} of ${view.innerWidth})`);
  }
  // W2: the page does not scroll sideways, and no panel inside the view does.
  const page = doc.documentElement;
  if (page.scrollWidth > view.innerWidth + 1) issues.push(`W2 the page scrolls sideways ${page.scrollWidth - view.innerWidth}px`);
  for (const panel of everything) {
    if (/^(auto|scroll)$/.test(view.getComputedStyle(panel).overflowX) && panel.scrollWidth > panel.clientWidth + 1) issues.push(`W2 ${name(panel)} scrolls sideways ${panel.scrollWidth - panel.clientWidth}px`);
  }
  // W3: text is not cut by its own box.
  for (const text of texts) {
    const style = view.getComputedStyle(text);
    const clips = /^(hidden|clip)$/.test(style.overflowX);
    if (clips && text.scrollWidth > text.clientWidth + 1) issues.push(`W3 ${name(text)} "${label(text)}" text is cut ${text.scrollWidth - text.clientWidth}px`);
  }
  // W4: no two visible controls overlap, other than the parts joined inside one field.
  const owner = (el: Element) => el.closest('.ui-field') ?? el.closest('.num-input-wrap');
  for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
    const a = controls[i], b = controls[j];
    if (a === undefined || b === undefined || a.contains(b) || b.contains(a)) continue;
    if (owner(a) !== null && owner(a) === owner(b)) continue;
    const p = painted(a), q = painted(b);
    const across = Math.min(p.right, q.right) - Math.max(p.left, q.left), down = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top);
    if (across > 2 && down > 2) issues.push(`W4 ${name(a)} "${label(a)}" overlaps ${name(b)} "${label(b)}" by ${Math.round(across)}x${Math.round(down)}`);
  }
  return {issues, measured};
}
