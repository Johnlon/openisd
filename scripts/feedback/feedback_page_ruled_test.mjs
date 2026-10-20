// Browser check for feedback-page.template.html: a picture John has answered (his comment is the last one on
// it) is not shown again; a picture an agent answered after him comes back. John, 20 Oct 2026: "you keep
// showing me images I've already ruled on". A fix with a side-by-side shows only that one picture ("why are you
// showing me same image over and over").
//   node feedback_page_ruled_test.mjs <generated index.html>   (exit 0 = pass)
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

// The pictures page loads the board's one thread module; serve the workspace copy.
const THREAD_JS = readFileSync('/home/john/work/winisd/_agent_files/board-state/thread.js', 'utf8');

const page_html = readFileSync(process.argv[2], 'utf8');
const md = `<table><thead><tr><th>Fix</th><th>Task</th><th>State</th><th>Pictures</th><th>Look at</th></tr></thead><tbody>
<tr><td>Ruled fix</td><td>T1</td><td>landed</td><td><a href="a/before.png">before</a> · <a href="a/after.png">after</a></td><td>x</td></tr>
<tr><td>Triple fix</td><td>T3</td><td>landed</td><td><a href="c/before.png">before</a> · <a href="c/after.png">after</a> · <a href="c/side-by-side.png">before and after</a></td><td>z</td></tr>
<tr><td>Open fix</td><td>T2</td><td>landed</td><td><a href="b/before.png">before</a> · <a href="b/after.png">after</a></td><td>y</td></tr>
<tr><td>Live fix</td><td>T4</td><td>landed</td><td>phone: <a href="d/before.png">before</a> <a href="d/after.png">after</a> <a href="mock-a.html?look=fb-handle">live</a></td><td>phone: the handle</td></tr>
<tr><td>Lone fix</td><td>T6</td><td>landed</td><td><a href="e/shot.png">screenshot</a></td><td>the shot</td></tr>
<tr><td>Live only</td><td>T5</td><td>landed</td><td><a href="mock-b.html?tab=vented&look=x">live</a></td><td>the vented tab</td></tr>
</tbody></table>`;
const thread = [
  { id: 'QO0.c1', by: 'John', at: '2026-10-20T01:00:00Z', text: '[picture: F/a/before.png] ok' },
  { id: 'QO0.c2', by: 'John', at: '2026-10-20T01:00:00Z', text: '[picture: F/a/after.png] ok' },
  { id: 'QO0.c3', by: 'John', at: '2026-10-20T01:00:00Z', text: '[picture: F/b/before.png] ok' },
  { id: 'QO0.c4', by: 'John', at: '2026-10-20T01:00:00Z', text: '[picture: F/b/after.png] too narrow' },
  { id: 'QO0.c5', by: 'bob', at: '2026-10-20T02:00:00Z', text: '[picture: F/b/after.png] fixed, new picture' },
];
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const browser = await chromium.launch();
const failures = [];
try {
  const p = await browser.newPage({ viewport: { width: 374, height: 705 } });
  await p.route('**/*', (r) => {
    const u = r.request().url();
    if (u.endsWith('/F/index.html')) return r.fulfill({ contentType: 'text/html', body: page_html });
    if (u.includes('index.md?html')) return r.fulfill({ contentType: 'text/html', body: md });
    if (u.endsWith('/board/thread.js')) return r.fulfill({ contentType: 'text/javascript', body: THREAD_JS });
    if (u.includes('/board/api/thread')) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ entries: thread, states: {}, owner: 'bob' }) });
    if (u.endsWith('.png')) return r.fulfill({ contentType: 'image/png', body: png });
    return r.fulfill({ status: 404, body: '' });
  });
  await p.goto('http://test.invalid/F/index.html');
  await p.waitForSelector('form.compose'); await p.waitForSelector('details.ruled', { state: 'attached' });
  // Answered pictures stay in page order, each in its own closed fold; none moved to a bottom fold.
  const allOrder = await p.$$eval('figure[data-item]', (fs) => fs.map((f) => f.dataset.name));
  const wantAll = ['F/mock-b.html?tab=vented&look=x', 'F/e/shot.png', 'F/d/before.png', 'F/b/before.png', 'F/c/side-by-side.png', 'F/a/before.png'];
  if (JSON.stringify(allOrder) !== JSON.stringify(wantAll)) failures.push(`page order ${JSON.stringify(allOrder)}, want ${JSON.stringify(wantAll)}`);
  if (await p.$('#out > details.ruled:last-child')) failures.push('answered fold at the bottom');
  const shown = await p.$$eval('figure[data-item]', (fs) => fs.filter((f) => f.checkVisibility()).map((f) => f.dataset.name));
  const want = ['F/mock-b.html?tab=vented&look=x', 'F/e/shot.png', 'F/d/before.png', 'F/b/before.png', 'F/c/side-by-side.png'];
  if (JSON.stringify(shown) !== JSON.stringify(want)) failures.push(`shown pictures ${JSON.stringify(shown)}, want ${JSON.stringify(want)}`);
  const summary = await p.$eval('details.ruled summary', (s) => s.textContent).catch(() => '');
  if (summary !== 'Answered: tap to show') failures.push(`answered fold summary: got ${JSON.stringify(summary)}`);
  // Live mock: a button keeping the query string, never a picture or plain link.
  const lives = await p.$$eval('a.live', (as) => as.map((a) => a.getAttribute('href')));
  const wantLive = ['mock-b.html?tab=vented&look=x', 'mock-a.html?look=fb-handle'];
  if (JSON.stringify(lives) !== JSON.stringify(wantLive)) failures.push(`live buttons ${JSON.stringify(lives)}, want ${JSON.stringify(wantLive)}`);
  if (await p.$('a[href^="mock-a.html"]:not(.live)')) failures.push('live link also rendered as a plain link');
  // The before picture is a still of today's app: it never carries the live-mock button.
  // A pair is ONE item: one live button for the group, not one per picture.
  if ((await p.$$('figure[data-name="F/d/before.png"] a.live')).length !== 1) failures.push('pair should carry exactly one live button');
  if (await p.$('figure[data-name="F/b/before.png"] a.live')) failures.push('pair without a live link got a live button');
  if (await p.$('figure[data-name="F/e/shot.png"] a.live')) failures.push('lone picture without live link got a button');
  // Before and after are ONE item: one figure, two pictures (before left), labels, one look line, one box.
  for (const n of ['F/b/before.png', 'F/d/before.png']) {
    const info = await p.$eval(`figure[data-name="${n}"]`, (f) => ({
      imgs: [...f.querySelectorAll('img')].map((i) => i.getAttribute('alt')),
      boxes: f.querySelectorAll('textarea').length, forms: f.querySelectorAll('form').length,
      looks: f.querySelectorAll('.look').length, caps: f.querySelectorAll('figcaption').length,
      labels: [...f.querySelectorAll('.lbl')].map((l) => l.textContent.trim()),
      kind: f.dataset.kind }));
    if (JSON.stringify(info.imgs) !== '["before","after"]') failures.push(`${n}: pair imgs ${JSON.stringify(info.imgs)}`);
    if (info.boxes !== 1 || info.forms !== 1) failures.push(`${n}: want one textarea/form, got ${info.boxes}/${info.forms}`);
    if (info.looks !== 1) failures.push(`${n}: want one look line, got ${info.looks}`);
    if (info.caps !== 0) failures.push(`${n}: figcaption noise`);
    if (JSON.stringify(info.labels) !== '["before","after"]') failures.push(`${n}: labels ${JSON.stringify(info.labels)}`);
  }
  // No separate figure for the after picture, or for before/after next to a side-by-side.
  if (await p.$('figure[data-name="F/b/after.png"], figure[data-name="F/d/after.png"]')) failures.push('after picture still its own item');
  if (await p.$('figure[data-name="F/c/before.png"], figure[data-name="F/c/after.png"]')) failures.push('before/after shown beside the side-by-side');
  if ((await p.$$('figure[data-name="F/c/side-by-side.png"] img')).length !== 1) failures.push('side-by-side item should hold one picture');
  if ((await p.$$('figure[data-name="F/e/shot.png"] img')).length !== 1) failures.push('lone picture should be one item with one picture');
  // The pair thread shows comments made on the after path too.
  const said = await p.$$eval('figure[data-name="F/b/before.png"] .c', (ds) => ds.map((d) => d.querySelector('.txt').textContent));
  if (said.length !== 3 || !said.some((t) => /too narrow/.test(t))) failures.push(`pair thread should hold both paths' comments: ${JSON.stringify(said)}`);
  // Less noise: the anchor is a small icon, not the word "link".
  const anchors = await p.$$eval('a.permalink', (as) => as.map((a) => [a.textContent.trim(), a.getAttribute('aria-label'), a.getAttribute('title')]));
  if (!anchors.length || anchors.some(([t, al, ti]) => /link/i.test(t) || t.length > 2 || al !== 'link to this item' || ti !== 'link to this item')) failures.push(`anchor not an icon: ${JSON.stringify(anchors)}`);
  for (const w of [374, 1280]) {
    await p.setViewportSize({ width: w, height: 800 });
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    if (sw > w) failures.push(`horizontal scroll at ${w}: ${sw}`);
  }
  await p.setViewportSize({ width: 374, height: 705 });
  const txt = await p.$eval('figure[data-name*="mock-b"]', (f) => f.querySelector('.look')?.textContent + '|' + !!f.querySelector('form.compose'));
  if (!/vented tab\|true/.test(txt)) failures.push(`live-only item lacks look/comment box: ${txt}`);
  // Deep link: every item has id + link anchor.
  const ids = await p.$$eval('figure[data-item]', (fs) => fs.map((f) => [f.id, f.querySelector('a.permalink')?.getAttribute('href')]));
  if (ids.some(([id, h]) => !id || !/^[a-z0-9-]+$/.test(id) || h !== '#' + id)) failures.push(`item ids/links bad: ${JSON.stringify(ids)}`);
  // Deep link to a visible item scrolls and rings it.
  await p.goto('http://test.invalid/F/index.html#f-b-before-png');
  await p.waitForSelector('details.ruled', { state: 'attached' }); await p.waitForSelector('figure.here');
  const inView = await p.$eval('figure.here', (f) => { const r = f.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
  if (!inView) failures.push('deep-linked item not scrolled into view');
  // Deep link into the closed answered fold opens it.
  await p.goto('http://test.invalid/F/index.html#f-a-before-png');
  await p.waitForSelector('figure.here');
  if (!(await p.$eval('details.ruled', (d) => d.open)) || !(await p.$eval('figure.here', (f) => f.checkVisibility()))) failures.push('deep link into answered fold did not open it');
} finally {
  await browser.close();
}
for (const f of failures) console.log('FAIL ' + f);
process.exit(failures.length ? 1 : 0);
