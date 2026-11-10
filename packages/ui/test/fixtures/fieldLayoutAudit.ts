/**
 * Rules 2 to 7 of .claude/rules/field-layout.md, measured on what is painted in `root`. Runs inside
 * the page. A fault is one line naming the rule, the group and the controls. No field CSS assumed.
 */
export function measureFieldLayoutRules(root: Element): string[] {
  const issues: string[] = [];
  const doc = root.ownerDocument;
  const view = doc.defaultView;
  if (view === null) throw new Error('Field layout rules need a live document');
  const shown = (el: Element) => el.checkVisibility({visibilityProperty: true, opacityProperty: true}) && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
  const name = (el: Element) => `${el.tagName.toLowerCase()}${el.id === '' ? '' : '#' + el.id}`;

  // Rule 2: every painted part against every overflow ancestor, its scroll panel and the window.
  const parts = [...root.querySelectorAll('input,select,button,label,.ui-field-unit,.num-stepper-btn')].filter(shown);
  for (const part of parts) {
    const box = part.getBoundingClientRect();
    const text = (part.textContent ?? '').trim().slice(0, 16);
    if (box.left < -0.5 || box.right > view.innerWidth + 0.5) issues.push(`R2 ${name(part)} "${text}" leaves the window sideways (${Math.round(box.left)}..${Math.round(box.right)})`);
    for (let ancestor = part.parentElement; ancestor !== null && ancestor !== doc.body; ancestor = ancestor.parentElement) {
      const style = view.getComputedStyle(ancestor);
      if (style.position === 'fixed') break;
      const clipsSideways = /^(hidden|clip|auto|scroll)$/.test(style.overflowX);
      const clipsUpDown = /^(hidden|clip)$/.test(style.overflowY);
      if (!clipsSideways && !clipsUpDown) continue;
      const frame = ancestor.getBoundingClientRect();
      const sideways = clipsSideways && (box.left < frame.left - 0.5 || box.right > frame.right + 0.5);
      const upDown = clipsUpDown && (box.top < frame.top - 0.5 || box.bottom > frame.bottom + 0.5);
      const painted = (() => { const top = doc.elementFromPoint(Math.min(Math.max(box.left + box.width / 2, 0), view.innerWidth - 1), Math.min(Math.max(box.top + box.height / 2, 0), view.innerHeight - 1)); return top !== null && (top === part || part.contains(top) || top.contains(part)) && box.bottom <= view.innerHeight && box.top >= 0; })();
      if ((sideways || upDown) && !painted) { issues.push(`R2 ${name(part)} "${text}" is cut by ${ancestor.tagName.toLowerCase()}.${String(ancestor.className).slice(0, 24)}`); break; }
    }
    if (part.tagName === 'LABEL' && part.scrollWidth > part.clientWidth + 1 && view.getComputedStyle(part).overflow !== 'visible') issues.push(`R2 label "${text}" is cut`);
  }
  for (const scroller of [root, ...root.querySelectorAll('*')]) {
    if (!shown(scroller)) continue;
    const style = view.getComputedStyle(scroller);
    if (/^(auto|scroll)$/.test(style.overflowX) && scroller.scrollWidth > scroller.clientWidth + 1) issues.push(`R2 ${scroller.tagName.toLowerCase()}.${String(scroller.className).slice(0, 24)} scrolls sideways ${scroller.scrollWidth - scroller.clientWidth}px`);
    if (/^(auto|scroll)$/.test(style.overflowY) && scroller.scrollHeight > scroller.clientHeight + 1 && scroller.matches('.tab-section,.content-panel,.what-if-panel,.modal-body')) issues.push(`R2 ${scroller.tagName.toLowerCase()}.${String(scroller.className).slice(0, 24)} scrolls up and down ${scroller.scrollHeight - scroller.clientHeight}px`);
  }

  // Groups: a group is the controls of one column that share a label edge.
  // The rules cover number boxes, counts and dropdowns; the radiator's free-text name is none of these.
  const columnSelector = '.vent-col,.pr-controls > div,.driver-columns > div,.box-fields-col,.what-if-panel,[role=dialog],.mob-np-body,.modal-body,.mob-content,.mob-sheet-body';
  const fields = [...root.querySelectorAll<HTMLElement>('.ui-field input:not([type=checkbox]):not([type=file]):not(.np-pr-name),select')].filter(shown).map(control => {
    const row = control.closest('.ui-field,.field,.mob-crow,.vpf-row,.what-if-fld,.ui-pick-field');
    const label = row?.querySelector('label');
    const box = control.getBoundingClientRect();
    const column = control.closest(columnSelector);
    return {
      control, tag: control.tagName, label: (label?.textContent ?? '').trim().slice(0, 22), labelX: label === null || label === undefined ? -1 : Math.round(label.getBoundingClientRect().x),
      column: column === null ? 'root' : `${column.className}`.slice(0, 20), x: Math.round(box.x), right: Math.round(box.right), width: Math.round(box.width), height: Math.round(box.height), y: Math.round(box.y),
    };
  });
  const groups = new Map<string, typeof fields>();
  for (const f of fields) {
    if (f.labelX < 0) continue;
    const key = `${f.column}@${f.labelX}`;
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  const needsMore = (select: HTMLSelectElement, width: number) => {
    const context = doc.createElement('canvas').getContext('2d');
    if (context === null) return false;
    context.font = view.getComputedStyle(select).font;
    return context.measureText(select.selectedOptions[0]?.text ?? '').width + 28 > width;
  };
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    const list = (pick: (f: (typeof group)[number]) => string) => group.map(f => `${f.label}:${pick(f)}`).join(', ');
    if (new Set(group.map(f => f.x)).size > 1) issues.push(`R3 ${key} value left edges differ: ${list(f => String(f.x))}`);
    const narrow = Math.min(...group.map(f => f.width));
    const widest = Math.max(...group.map(f => f.width));
    // A pick list may be wider than the narrowest box when its text needs it, or narrower than the widest when its text still fits (the 90 px short dropdowns, QO428).
    const sameEdge = group.filter(f => !(f.control instanceof HTMLSelectElement && ((f.width > narrow && needsMore(f.control, narrow)) || (f.width < widest && !needsMore(f.control, f.width)))));
    if (new Set(sameEdge.map(f => f.right)).size > 1 || new Set(sameEdge.map(f => f.width)).size > 1) issues.push(`R4 ${key} value widths differ: ${list(f => `${f.width}/${f.right}`)}`);
    for (const tag of ['INPUT', 'SELECT']) {
      const same = group.filter(f => f.tag === tag);
      if (new Set(same.map(f => f.height)).size > 1) issues.push(`R5 ${key} ${tag.toLowerCase()} heights differ: ${same.map(f => `${f.label}:${f.height}`).join(', ')}`);
    }
  }
  // Rule 6: the same label in columns side by side sits at one y.
  const byLabel = new Map<string, typeof fields>();
  for (const f of fields) if (f.label !== '') byLabel.set(f.label, [...(byLabel.get(f.label) ?? []), f]);
  for (const [label, same] of byLabel) {
    const sideBySide = new Set(same.map(f => f.labelX)).size > 1 && new Set(same.map(f => f.column)).size === 1;
    if (sideBySide && Math.max(...same.map(f => f.y)) - Math.min(...same.map(f => f.y)) > 1) issues.push(`R6 "${label}" sits at different y in columns side by side: ${same.map(f => f.y).join(', ')}`);
  }
  // Rule 7: no two painted parts overlap, other than the parts joined inside one field.
  const owner = (el: Element) => el.closest('.ui-field') ?? el.closest('.num-input-wrap');
  for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
    const a = parts[i], b = parts[j];
    if (a === undefined || b === undefined || a.contains(b) || b.contains(a)) continue;
    if (owner(a) !== null && owner(a) === owner(b)) continue;
    const p = a.getBoundingClientRect(), q = b.getBoundingClientRect();
    const across = Math.min(p.right, q.right) - Math.max(p.left, q.left), down = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top);
    if (across > 2 && down > 2) issues.push(`R7 ${name(a)} "${(a.textContent ?? '').trim().slice(0, 12)}" overlaps ${name(b)} "${(b.textContent ?? '').trim().slice(0, 12)}" by ${Math.round(across)}x${Math.round(down)}`);
  }
  return issues;
}
