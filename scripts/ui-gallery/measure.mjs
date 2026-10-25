// Runs in the page. Pure read: scroll sizes and buttons clipped by the viewport or an overflow:hidden/clip ancestor.
export function measure() {
  const de = document.documentElement;
  const vw = de.clientWidth, vh = de.clientHeight;
  const clippedList = [];
  const label = (e) => (e.getAttribute('aria-label') || e.title || e.textContent || '').trim().slice(0, 30);
  for (const e of document.querySelectorAll('button,[role=button]')) {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    if (r.width < 1 || r.height < 1 || cs.visibility === 'hidden' || cs.display === 'none') continue;
    // Scrolled out of a scroll container is scrolling, not clipping.
    let scroller = null;
    for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) {
      const acs = getComputedStyle(a);
      if (/(auto|scroll)/.test(acs.overflowX + acs.overflowY) && a.scrollHeight + a.scrollWidth > a.clientHeight + a.clientWidth + 1) { scroller = a; break; }
    }
    if (scroller) {
      const sr = scroller.getBoundingClientRect();
      const out = r.right <= sr.left || r.left >= sr.right || r.bottom <= sr.top || r.top >= sr.bottom;
      if (out) continue;
    }
    let why = '';
    if (r.left < -1 || r.right > vw + 1 || r.top < -1) why = 'viewport';
    else if (r.bottom > vh + 1 && de.scrollHeight <= vh + 1) why = 'viewport';
    for (let a = e.parentElement; a && !why && a !== document.body; a = a.parentElement) {
      const acs = getComputedStyle(a);
      if (acs.overflowX === 'auto' || acs.overflowX === 'scroll' || acs.overflowY === 'auto' || acs.overflowY === 'scroll') break;
      if (acs.overflowX !== 'hidden' && acs.overflowX !== 'clip' && acs.overflowY !== 'hidden' && acs.overflowY !== 'clip') continue;
      const ar = a.getBoundingClientRect();
      if (ar.width < 1) continue;
      const out = r.left < ar.left - 1 || r.right > ar.right + 1 || r.top < ar.top - 1 || r.bottom > ar.bottom + 1;
      const inside = r.right > ar.left && r.left < ar.right && r.bottom > ar.top && r.top < ar.bottom;
      if (out && inside) why = 'ancestor';
    }
    if (why) clippedList.push(`${label(e)} [${why}]`);
  }
  return { scrollWidth: de.scrollWidth, clientWidth: vw, scrollHeight: de.scrollHeight, clientHeight: vh, clipped: clippedList.length, clippedList: clippedList.slice(0, 10) };
}
