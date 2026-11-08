/**
 * Source scan (T742, QO466 c1/c3): the app uses its bundled Inter and nothing else. Any font-family or
 * font shorthand in the UI source (css, vue, html) or the chart font names Inter, or inherits. No system-ui,
 * sans-serif, monospace, Arial, Segoe etc.: a glyph must never land on a device's own font.
 */
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {describe, expect, it} from 'vitest';

const ROOT = new URL('../../../../', import.meta.url).pathname;
const FILES = execFileSync('git', ['ls-files', 'packages/ui/src', 'packages/ui/about', 'packages/ui/index.html', 'packages/design/chart/layout.ts'], {cwd: ROOT, encoding: 'utf8'})
  .split('\n').filter(f => /\.(css|vue|html|ts)$/.test(f));
const KEYWORDS = new Set(['inherit', 'initial', 'unset', 'revert']);
const FAMILY_DECLARATION = /font-family\s*[:=]\s*"?([^;}"\n]+)/g;
const SHORTHAND = /(?<![\w-])font\s*:\s*((?:\d|normal|italic|oblique|bold)[^;}\n]*)/g;
const CANVAS = /\.font\s*=\s*([^;\n]+)/g;
const SIZE_THEN_FAMILY = /\d(?:px|rem|em|%)(?:\/[\w.()%-]+)?\s+(.+)$/;

function families(list: string): string[] {
  return list.replace(/!important/, '').split(',').map(f => f.trim().replace(/^["']|["']$/g, ''));
}

function offenders(): string[] {
  const out: string[] = [];
  for (const file of FILES) {
    const text = readFileSync(ROOT + file, 'utf8');
    const check = (what: string, names: string[]): void => {
      for (const name of names) if (name !== 'Inter' && !KEYWORDS.has(name)) out.push(`${file}: ${what} names "${name}"`);
    };
    for (const m of text.matchAll(FAMILY_DECLARATION)) check(`font-family ${m[1]}`, families(m[1] ?? ''));
    for (const m of text.matchAll(SHORTHAND)) {
      const value = (m[1] ?? '').replace(/!important/, '').trim();
      if (KEYWORDS.has(value)) continue;
      const family = SIZE_THEN_FAMILY.exec(value)?.[1];
      if (family === undefined) out.push(`${file}: font shorthand "${value}" has no size and family`);
      else check(`font ${value}`, families(family));
    }
    for (const m of text.matchAll(CANVAS)) if (!/layout\.font\(|style\.font/.test(m[1] ?? '')) out.push(`${file}: canvas font ${m[1]}`);
  }
  return out;
}

describe('the UI source names only the bundled Inter', () => {
  it('scans some files', () => expect(FILES.length).toBeGreaterThan(50));
  it('has no other font family anywhere', () => expect(offenders()).toEqual([]));
});
