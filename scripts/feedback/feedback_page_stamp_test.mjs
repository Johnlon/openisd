// Browser check: the pictures page shows a "Stamp: ..." line under every picture (T765).
//   node feedback_page_stamp_test.mjs <generated index.html>   (exit 0 = pass)
// A PNG with a `stamp` text chunk shows it; a PNG without shows "Stamp: none".
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const THREAD_JS = readFileSync('/home/john/work/winisd/_agent_files/board-state/thread.js', 'utf8');
const page_html = readFileSync(process.argv[2], 'utf8');
const STAMP = 'source=test; build=b1; commit=abc; viewport=374x705';

function chunk(type, data) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const body = Buffer.concat([Buffer.from(type), data]);
  let c = 0xffffffff; for (const b of body) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE((c ^ 0xffffffff) >>> 0);
  return Buffer.concat([len, body, crc]);
}
const plain = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const ihdrEnd = 8 + 25;
const stamped = Buffer.concat([plain.subarray(0, ihdrEnd), chunk('tEXt', Buffer.from('stamp\0' + STAMP, 'latin1')), plain.subarray(ihdrEnd)]);

const MD = `<table><thead><tr><th>Fix</th><th>Task</th><th>State</th><th>Pictures</th><th>Look at</th></tr></thead><tbody>
<tr><td>Fix A</td><td>T1</td><td>landed</td><td><a href="stamped.png">before</a> · <a href="plain.png">after</a></td><td>x</td></tr></tbody></table>`;

const browser = await chromium.launch();
const failures = [];
try {
  const p = await browser.newPage();
  await p.route('**/*', (r) => {
    const u = r.request().url();
    if (u.endsWith('/F/index.html')) return r.fulfill({ contentType: 'text/html', body: page_html });
    if (u.includes('index.md?html')) return r.fulfill({ contentType: 'text/html', body: MD });
    if (u.endsWith('/board/thread.js')) return r.fulfill({ contentType: 'text/javascript', body: THREAD_JS });
    if (u.endsWith('stamped.png')) return r.fulfill({ contentType: 'image/png', body: stamped });
    if (u.endsWith('plain.png')) return r.fulfill({ contentType: 'image/png', body: plain });
    if (u.includes('/board/api/')) return r.fulfill({ contentType: 'application/json', body: '{"entries":[],"states":{}}' });
    return r.fulfill({ status: 404, body: '' });
  });
  await p.goto('http://test.invalid/F/index.html');
  await p.waitForFunction(() => document.querySelectorAll('.stamp').length === 2);
  const lines = await p.locator('.stamp').allTextContents();
  if (lines[0] !== 'Stamp: ' + STAMP) failures.push('stamped picture line: ' + lines[0]);
  if (!lines[1].startsWith('Stamp: none')) failures.push('unstamped picture line: ' + lines[1]);
} finally { await browser.close(); }
if (failures.length) { console.error('FAIL\n' + failures.join('\n')); process.exit(1); }
console.log('ok: stamp line under every picture');
