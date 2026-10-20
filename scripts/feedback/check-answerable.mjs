#!/usr/bin/env node
// Fails (exit 1) when a page for John cannot be answered: an item (text, or text plus pictures)
// without its own comment box or without a clear statement (what to do / look at / the question), a picture
// not marked by mark-diff.py (PNG text chunk marked=1), no "What to do" first line, or sideways scroll. Usage: check-answerable.mjs <url>...
// Sizes: 374x705 (phone) and 1280x800. Uses openisd's playwright; run from outside the openisd folder.
import fs from 'node:fs';
import { chromium } from 'playwright';

const SIZES = [[374, 705], [1280, 800]];

function inspect() {
  const problems = [];
  const pics = [];
  const first = document.body.innerText.trim().split('\n')[0] || '';
  if (!/^\W*what to do\b/i.test(first)) problems.push(`first line is not a "What to do" line: "${first.slice(0, 60)}"`);
  const box = (el) => el.matches('input[type=text],input:not([type]),textarea');
  const hasBox = (el) => [...el.querySelectorAll('input,textarea')].some(box);
  const big = (i) => { const b = i.getBoundingClientRect(); return b.width >= 64 && b.height >= 64; }; // smaller = icon inside a mock
  const items = new Set(document.querySelectorAll('[data-item]'));
  for (const img of document.images) {
    if (!big(img) || img.closest('[data-item]')) continue;
    let up = img.parentElement;
    while (up && up !== document.body && !hasBox(up)) up = up.parentElement;
    if (!up || up === document.body) { problems.push(`picture has no comment box: ${img.getAttribute('alt') || img.getAttribute('src').slice(0, 60)}`); continue; }
    items.add(up);
  }
  for (const it of items) {
    if (it.closest('details.ruled:not([open])')) continue; // John has answered these; the page folds them away
    const label = it.dataset.name || it.querySelector('img')?.getAttribute('alt') || it.innerText.trim().slice(0, 40);
    if (!hasBox(it)) problems.push(`item has no comment box: ${label}`);
    const imgs = [...it.querySelectorAll('img')].filter(big);
    const allowed = it.hasAttribute('data-pair') ? 2 : 1; // a before and its after are one item
    if (imgs.length > allowed) problems.push(`item shares its comment box between ${imgs.length} pictures: ${label}`);
    const st = it.querySelector('.look,[data-statement]');
    const text = (st?.innerText || '').replace(/^\s*(look at|what to do|question)\s*:/i, '').trim();
    if (!text || /not written yet/i.test(text)) problems.push(`item has no clear statement (what to do / look at / question): ${label}`);
    // In a pair, name the picture itself (its link), not the item, which carries the before's name.
    const own = (img) => (imgs.length > 1 && img.closest('a')?.getAttribute('href')) || label;
    for (const img of imgs) pics.push({ label: own(img), src: img.currentSrc || img.src });
  }
  return { problems, sw: document.documentElement.scrollWidth, pics };
}

async function bytesOf(src) {
  if (src.startsWith('data:')) return Buffer.from(decodeURIComponent(src.slice(src.indexOf(',') + 1)), src.includes(';base64') ? 'base64' : 'utf8');
  if (src.startsWith('file:')) return fs.readFileSync(new URL(src));
  return Buffer.from(await (await fetch(src)).arrayBuffer());
}

// True when the PNG carries the tEXt chunk marked=1 that mark-diff.py writes.
function isMarked(buf) {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) return false;
  for (let p = 8; p + 8 <= buf.length;) {
    const len = buf.readUInt32BE(p), type = buf.toString('latin1', p + 4, p + 8);
    if (type === 'tEXt' && buf.toString('latin1', p + 8, p + 8 + len) === 'marked\x001') return true;
    p += 12 + len;
  }
  return false;
}

const legacy = process.argv.includes('--legacy'); // old pages: pictures made before the marking rule are not re-marked
const urls = process.argv.slice(2).filter(a => a !== '--legacy');
if (!urls.length) { console.error('usage: check-answerable.mjs [--legacy] <url>...'); process.exit(2); }
const browser = await chromium.launch();
let failed = false;
try {
  for (const url of urls) {
    for (const [w, h] of SIZES) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
      const { problems, sw, pics } = await page.evaluate(inspect);
      for (const { label, src } of pics) {
        try { if (!legacy && !isMarked(await bytesOf(src))) problems.push(`picture not marked by mark-diff.py (no red mark to look at): ${label}`); }
        catch (x) { problems.push(`picture unreadable (${x.message}): ${label}`); }
      }
      if (sw > w) problems.push(`scrollWidth ${sw} > viewport ${w}`);
      for (const p of problems) { failed = true; console.log(`FAIL ${url} @${w}x${h}: ${p}`); }
      if (!problems.length) console.log(`ok   ${url} @${w}x${h} scrollWidth ${sw}`);
      await page.close();
    }
  }
} finally { await browser.close(); }
process.exit(failed ? 1 : 0);
