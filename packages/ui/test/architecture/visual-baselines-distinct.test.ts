/**
 * Every visual baseline shows the view it is named for (BUG_20261115_visual-baselines-cover-no-dialogs): the committed pictures
 * are read, not drawn, so this holds for CI-drawn pictures too.
 *  - No two screens draw one picture unless `SAME_PICTURE` names them as one screen.
 *  - No popup screen draws the screen it was opened from: a popup that never opened (a native file chooser, a step that does nothing).
 *  - A view named in `SAME_VIEW` or `CANNOT_BE_SHOWN` has no picture.
 */
import {describe, expect, it} from 'vitest';
import {createHash} from 'node:crypto';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {BASE_SCREEN, CANNOT_BE_SHOWN, SAME_PICTURE, SAME_VIEW, WAITING_FOR_FIX} from '../visual/pictureSet.js';

const BUGS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'bugs');

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'visual', 'visual.browser.spec.ts-snapshots');
const SKINS = ['desktop', 'mobile'];

/** The picture's pixels, not its file: the stamp chunk differs from run to run. IHDR and the compressed pixel data are hashed. */
function pixelsOf(file: string): string {
  const png = readFileSync(join(DIR, file));
  const hash = createHash('sha256');
  for (let at = 8; at < png.length;) {
    const length = png.readUInt32BE(at);
    const type = png.toString('latin1', at + 4, at + 8);
    if (type === 'IHDR' || type === 'IDAT') hash.update(png.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }
  return hash.digest('hex');
}

const files = readdirSync(DIR).filter(f => f.endsWith('.png'));
const names = files.map(f => f.replace(/\.png$/, ''));
const byPixels = new Map<string, string[]>();
for (const file of files) {
  const key = pixelsOf(file);
  byPixels.set(key, [...(byPixels.get(key) ?? []), file.replace(/\.png$/, '')]);
}

describe('visual baselines each show their own view', () => {
  it('no two screens draw the same picture unless declared one screen', () => {
    const undeclared = [...byPixels.values()].filter(group => group.length > 1)
      .filter(group => !SAME_PICTURE.some(declared => declared.screens.length === group.length && declared.screens.every(s => group.includes(s))));
    expect(undeclared.map(group => group.join(' = '))).toEqual([]);
  });

  it('every declared group is still a group of identical pictures', () => {
    for (const declared of SAME_PICTURE) {
      const hashes = new Set(declared.screens.map(s => (names.includes(s) ? pixelsOf(`${s}.png`) : s)));
      expect(hashes.size, declared.screens.join(' = ')).toBe(1);
    }
  });

  for (const skin of SKINS) {
    it(`${skin}: the screen popups open from has a picture, and no popup draws it`, () => {
      expect(existsSync(join(DIR, `${skin}-${BASE_SCREEN}.png`)), `${skin}-${BASE_SCREEN}.png`).toBe(true);
      const base = pixelsOf(`${skin}-${BASE_SCREEN}.png`);
      const same = files.filter(f => f.startsWith(`${skin}-dialog-`) && pixelsOf(f) === base);
      expect(same, 'popup screens whose picture is the screen they open from').toEqual([]);
    });
  }

  it('a same-view alias or a view that cannot be shown has no picture', () => {
    const left = [...SAME_VIEW.keys(), ...CANNOT_BE_SHOWN.keys(), ...WAITING_FOR_FIX.keys()].filter(key => names.includes(key));
    expect(left).toEqual([]);
  });

  it('a view waiting for a fix names a bug file that exists', () => {
    const missing = [...WAITING_FOR_FIX.values()].filter(bug => !existsSync(join(BUGS, `${bug}.md`)));
    expect(missing).toEqual([]);
  });

  it('an alias keeps a picture under its kept name', () => {
    const missing = [...SAME_VIEW.values()].map(v => v.kept).filter(kept => !names.includes(kept));
    expect(missing).toEqual([]);
  });
});
