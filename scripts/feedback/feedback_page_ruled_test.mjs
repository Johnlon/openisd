// Browser check for feedback-page.template.html: a picture John has answered (his comment is the last one on
// it) is not shown again; a picture an agent answered after him comes back. John, 20 Oct 2026: "you keep
// showing me images I've already ruled on". A fix with a side-by-side shows only that one picture ("why are you
// showing me same image over and over").
//   node feedback_page_ruled_test.mjs <generated index.html>   (exit 0 = pass)
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const page_html = readFileSync(process.argv[2], 'utf8');
const md = `<table><thead><tr><th>Fix</th><th>Task</th><th>State</th><th>Pictures</th><th>Look at</th></tr></thead><tbody>
<tr><td>Ruled fix</td><td>T1</td><td>landed</td><td><a href="a/before.png">before</a> · <a href="a/after.png">after</a></td><td>x</td></tr>
<tr><td>Triple fix</td><td>T3</td><td>landed</td><td><a href="c/before.png">before</a> · <a href="c/after.png">after</a> · <a href="c/side-by-side.png">before and after</a></td><td>z</td></tr>
<tr><td>Open fix</td><td>T2</td><td>landed</td><td><a href="b/before.png">before</a> · <a href="b/after.png">after</a></td><td>y</td></tr>
</tbody></table>`;
const thread = [
  { by: 'John', at: '2026-10-20T01:00:00Z', text: '[picture: F/a/before.png] ok' },
  { by: 'John', at: '2026-10-20T01:00:00Z', text: '[picture: F/a/after.png] ok' },
  { by: 'John', at: '2026-10-20T01:00:00Z', text: '[picture: F/b/before.png] ok' },
  { by: 'John', at: '2026-10-20T01:00:00Z', text: '[picture: F/b/after.png] too narrow' },
  { by: 'bob', at: '2026-10-20T02:00:00Z', text: '[picture: F/b/after.png] fixed, new picture' },
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
    if (u.endsWith('/board/api/items')) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [{ id: 'QO0', thread }] }) });
    if (u.endsWith('.png')) return r.fulfill({ contentType: 'image/png', body: png });
    return r.fulfill({ status: 404, body: '' });
  });
  await p.goto('http://test.invalid/F/index.html');
  await p.waitForSelector('form.cm'); await p.waitForSelector('details.ruled', { state: 'attached' });
  const shown = await p.$$eval('figure[data-item]', (fs) => fs.filter((f) => f.checkVisibility()).map((f) => f.dataset.name));
  const want = ['F/b/after.png', 'F/c/side-by-side.png'];
  if (JSON.stringify(shown) !== JSON.stringify(want)) failures.push(`shown pictures ${JSON.stringify(shown)}, want ${JSON.stringify(want)}`);
  const summary = await p.$eval('details.ruled summary', (s) => s.textContent).catch(() => '');
  if (!/3/.test(summary)) failures.push(`no "already answered (3)" fold: got ${JSON.stringify(summary)}`);
} finally {
  await browser.close();
}
for (const f of failures) console.log('FAIL ' + f);
process.exit(failures.length ? 1 : 0);
