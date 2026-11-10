/**
 * Glyph coverage (T742, QO466): every non-ASCII character the UI source can put on screen is drawn by a
 * bundled face, so no glyph falls back to a device font. Per skin: the text face has it, or an AppSymbols
 * subset in fonts.css has it AND lists it in its unicode-range (the browser uses a face only inside its range).
 * winisdSafeText.ts and winisdBytes.ts are WinISD file-text mapping tables, never shown.
 */
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import * as fontkit from 'fontkit';
import {describe, expect, it} from 'vitest';

const ROOT = new URL('../../../../', import.meta.url).pathname;
const ASSETS = `${ROOT}packages/ui/src/assets/fonts/`;
const SOURCE_FILES = execFileSync('git', ['ls-files', 'packages/ui/src', 'packages/ui/about', 'packages/ui/index.html', 'packages/design'], {cwd: ROOT, encoding: 'utf8'})
  .split('\n').filter(f => /\.(css|vue|html|ts)$/.test(f) && !f.includes('/test/') && !/winisd(SafeText|Bytes)\.ts$/.test(f));
/** Characters with no glyph in any bundled face by design: NO-BREAK SPACE is whitespace. */
const WHITESPACE = new Set([' ']);

function shownNonAscii(): Set<string> {
  const found = new Set<string>();
  for (const file of SOURCE_FILES) {
    for (const line of readFileSync(ROOT + file, 'utf8').split('\n')) {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
      for (const ch of line) if (ch.codePointAt(0)! > 127 && !WHITESPACE.has(ch)) found.add(ch);
    }
  }
  return found;
}

function hasGlyph(path: string, ch: string): boolean {
  const font = fontkit.openSync(path);
  if ('fonts' in font) throw new Error(`${path} is a collection`);
  return font.hasGlyphForCodePoint(ch.codePointAt(0)!);
}

interface SymbolsFace {readonly file: string; readonly ranges: readonly [number, number][]}

function symbolsFaces(): SymbolsFace[] {
  const css = readFileSync(`${ROOT}packages/ui/src/fonts.css`, 'utf8');
  const faces: SymbolsFace[] = [];
  for (const rule of css.match(/@font-face\s*\{[^}]*font-family:\s*AppSymbols[^}]*\}/g) ?? []) {
    const file = /url\('\.\/assets\/fonts\/([^']+)'\)/.exec(rule)?.[1];
    const range = /unicode-range:\s*([^;]+);/.exec(rule)?.[1];
    if (file === undefined || range === undefined) throw new Error(`AppSymbols rule without a file or unicode-range: ${rule}`);
    const ranges = range.split(',').map((part): [number, number] => {
      const [lo, hi] = part.trim().replace('U+', '').split('-');
      return [parseInt(lo!, 16), parseInt(hi ?? lo!, 16)];
    });
    faces.push({file, ranges});
  }
  return faces;
}

const TEXT_FACES: Readonly<Record<string, string>> = {
  desktop: `${ASSETS}selawik-400.woff2`,
  phone: `${ROOT}node_modules/@fontsource/roboto/files/roboto-latin-400-normal.woff2`,
  mono: `${ROOT}node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2`,
};

describe('every non-ASCII character the UI shows is drawn by a bundled face', () => {
  const chars = shownNonAscii();
  const faces = symbolsFaces();

  it('finds the characters', () => expect(chars.size).toBeGreaterThan(40));

  for (const [skin, textFace] of Object.entries(TEXT_FACES)) {
    it(`${skin}: text face or AppSymbols covers all`, () => {
      const uncovered = [...chars].filter(ch => !hasGlyph(textFace, ch)
        && !faces.some(face => face.ranges.some(([lo, hi]) => ch.codePointAt(0)! >= lo && ch.codePointAt(0)! <= hi) && hasGlyph(ASSETS + face.file, ch)));
      expect(uncovered.map(ch => `${ch} U+${ch.codePointAt(0)!.toString(16)}`)).toEqual([]);
    });
  }
});
