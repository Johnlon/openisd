// Browser check for feedback-page.template.html: rows that name a leader in the optional "Same as" column fold
// under the leader ("Same change in N more pictures (show)"), and every folded picture keeps its own comment box.
//   node feedback_page_group_test.mjs <generated index.html>   (exit 0 = pass)
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const THREAD_JS = readFileSync('/home/john/work/winisd/_agent_files/board-state/thread.js', 'utf8');
const page_html = readFileSync(process.argv[2], 'utf8');
const row = (fix, same) => `<tr><td>${fix}</td><td>T1</td><td>landed</td><td><a href="${fix}.before.png">before</a> <a href="${fix}.after.png">after</a></td><td>the box</td><td>${same}</td></tr>`;
const md = `<table><thead><tr><th>Fix</th><th>Task</th><th>State</th><th>Pictures</th><th>Look at</th><th>Same as</th></tr></thead><tbody>
${row('lead', '')}${row('twin1', 'lead')}${row('twin2', 'lead')}${row('other', '')}
</tbody></table>`;
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
    if (u.includes('/board/api/thread')) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ entries: [], states: {}, owner: 'bob' }) });
    if (u.endsWith('.png')) return r.fulfill({ contentType: 'image/png', body: png });
    return r.fulfill({ status: 404, body: '' });
  });
  await p.goto('http://test.invalid/F/index.html');
  await p.waitForSelector('form.compose');
  const folds = await p.$$eval('details.same', (ds) => ds.map((d) => d.querySelector('summary').textContent));
  if (JSON.stringify(folds) !== JSON.stringify(['Same change in 2 more pictures (show)'])) failures.push(`folds ${JSON.stringify(folds)}`);
  const shown = await p.$$eval('figure[data-item]', (fs) => fs.filter((f) => f.checkVisibility()).map((f) => f.dataset.name));
  if (JSON.stringify(shown) !== JSON.stringify(['F/other.before.png', 'F/lead.before.png'])) failures.push(`shown before opening ${JSON.stringify(shown)}`);
  const all = await p.$$eval('figure[data-item]', (fs) => fs.map((f) => [f.dataset.name, f.querySelectorAll('form.compose textarea').length, f.querySelectorAll('.look').length]));
  if (all.length !== 4) failures.push(`figures ${all.length}, want 4`);
  for (const [n, boxes, looks] of all) if (boxes !== 1 || looks !== 1) failures.push(`${n}: ${boxes} comment boxes, ${looks} look lines`);
  if (await p.$('details.same figure[data-name="F/lead.before.png"]')) failures.push('leader is inside the fold');
  await p.click('details.same summary');
  const after = await p.$$eval('figure[data-item]', (fs) => fs.filter((f) => f.checkVisibility()).length);
  if (after !== 4) failures.push(`visible after opening the fold: ${after}, want 4`);
} finally { await browser.close(); }
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('ok');
