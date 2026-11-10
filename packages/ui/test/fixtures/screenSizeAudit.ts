/* global document, window, getComputedStyle */
/**
 * Screen-size audit (docs/spec/SPEC_UI.md UI-5). `auditScreen` runs in the page and returns one line per fault.
 * Pass it to `locator.evaluate` / `page.evaluate` with an AuditMode. Pure DOM reads, no app state.
 */
export type AuditMode =
  | {readonly kind: 'must-fit'; readonly vertical: boolean}
  | {readonly kind: 'may-scroll'};


/** Runs inside the page (serialised by Playwright), so it uses no names from outside itself. */
export function auditScreen(mode: AuditMode): string[] {
  const CONTROLS = 'button, input:not([type=hidden]), select, textarea, a[href], [role=button], [role=tab], [role=menuitem], summary';
  const MIN_PANEL_PX = 40;
  const faults: string[] = [];
  const doc = document.documentElement;
  const vw = doc.clientWidth;
  const vh = doc.clientHeight;
  const name = (el: Element): string => {
    const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 24);
    const cls = typeof el.className === 'string' ? el.className.split(' ')[0] : '';
    return `${el.tagName.toLowerCase()}${cls !== '' ? '.' + cls : ''}${text !== '' ? ` "${text}"` : ''}`;
  };
  const shown = (el: Element): boolean => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    for (let e: Element | null = el; e !== null; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
    }
    return true;
  };
  const controls = Array.from(document.querySelectorAll(CONTROLS)).filter(shown);

  // Page scroll.
  if (mode.kind === 'must-fit') {
    if (doc.scrollWidth > vw) faults.push(`page scrolls sideways: scrollWidth ${doc.scrollWidth} > ${vw}`);
    if (mode.vertical && doc.scrollHeight > vh) faults.push(`page scrolls down: scrollHeight ${doc.scrollHeight} > ${vh}`);
  }

  // Where a control sits against the window and against any ancestor that clips it.
  const isScroller = (s: CSSStyleDeclaration, axis: 'x' | 'y'): boolean => /auto|scroll/.test(axis === 'x' ? s.overflowX : s.overflowY);
  const isClipper = (s: CSSStyleDeclaration, axis: 'x' | 'y'): boolean => /hidden|clip/.test(axis === 'x' ? s.overflowX : s.overflowY);
  for (const el of controls) {
    const r = el.getBoundingClientRect();
    if (mode.kind === 'must-fit') {
      if (r.left < -1 || r.right > vw + 1) faults.push(`control off screen sideways: ${name(el)} x ${Math.round(r.left)}..${Math.round(r.right)} of ${vw}`);
      if (mode.vertical && (r.top < -1 || r.bottom > vh + 1)) faults.push(`control off screen vertically: ${name(el)} y ${Math.round(r.top)}..${Math.round(r.bottom)} of ${vh}`);
    }
    // Unreachable: cut by an overflow:hidden ancestor (a scroller can bring it into view; hidden cannot).
    let xOpen = false; let yOpen = false;
    for (let a = el.parentElement; a !== null; a = a.parentElement) {
      const s = getComputedStyle(a);
      const ar = a.getBoundingClientRect();
      // Nearer scrollers bring the control into view, so they settle that axis.
      if (isScroller(s, 'x')) xOpen = true;
      if (isScroller(s, 'y')) yOpen = true;
      const cutX = !xOpen && isClipper(s, 'x') && (r.right > ar.right + 1 || r.left < ar.left - 1);
      const cutY = !yOpen && isClipper(s, 'y') && (r.bottom > ar.bottom + 1 || r.top < ar.top - 1);
      if (cutX || cutY) { faults.push(`control cut by overflow:hidden ${name(a)}: ${name(el)}`); break; }
    }
    // Left of or above the page origin cannot be scrolled to.
    const pageLeft = r.left + window.scrollX;
    if (mode.kind === 'may-scroll' && pageLeft < -1 && !el.closest('[style*=fixed]')) faults.push(`control left of the page: ${name(el)}`);
  }

  // Text cut: an element with its own text whose content is wider than its box and does not scroll.
  for (const el of Array.from(document.querySelectorAll('body *'))) {
    if (!shown(el)) continue;
    const own = Array.from(el.childNodes).some(n => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '');
    if (!own) continue;
    const s = getComputedStyle(el);
    // Only a box that clips its overflow can cut text; a hit-area pseudo-element is not text.
    if (s.display === 'inline' || !isClipper(s, 'x') || isScroller(s, 'x') || s.writingMode !== 'horizontal-tb') continue;
    if (el.scrollWidth > el.clientWidth + 1) faults.push(`text cut: ${name(el)} content ${el.scrollWidth} > box ${el.clientWidth}`);
  }

  // Overlap: two top-most controls whose boxes cross, neither inside the other.
  const topmost = (el: Element): boolean => {
    const r = el.getBoundingClientRect();
    const x = Math.min(Math.max(r.left + r.width / 2, 0), vw - 1);
    const y = Math.min(Math.max(r.top + r.height / 2, 0), vh - 1);
    const hit = document.elementFromPoint(x, y);
    return hit !== null && (el.contains(hit) || hit.contains(el));
  };
  const visibleNow = controls.filter(el => {
    const r = el.getBoundingClientRect();
    return r.right > 0 && r.bottom > 0 && r.left < vw && r.top < vh && topmost(el);
  });
  for (let i = 0; i < visibleNow.length; i++) {
    for (let j = i + 1; j < visibleNow.length; j++) {
      const a = visibleNow[i]; const b = visibleNow[j];
      if (a.contains(b) || b.contains(a)) continue;
      // A unit sits inside its own number box by design.
      const fieldA = a.closest('.ui-field, .mob-ui-field, .field');
      if (fieldA !== null && fieldA === b.closest('.ui-field, .mob-ui-field, .field') && (a.matches('.ui-field-unit') || b.matches('.ui-field-unit'))) continue;
      const ra = a.getBoundingClientRect(); const rb = b.getBoundingClientRect();
      const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (w > 2 && h > 2) faults.push(`controls overlap: ${name(a)} and ${name(b)} by ${Math.round(w)}x${Math.round(h)}`);
    }
  }

  // A panel that collapsed to a strip.
  for (const el of Array.from(document.querySelectorAll('canvas, .content-panel, .mob-content, .chart-panel')).filter(shown)) {
    const r = el.getBoundingClientRect();
    if (Math.min(r.width, r.height) < MIN_PANEL_PX) faults.push(`panel collapsed: ${name(el)} is ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  return Array.from(new Set(faults));
}
