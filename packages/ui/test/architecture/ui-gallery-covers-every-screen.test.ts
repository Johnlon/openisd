/**
 * The UI gallery (scripts/ui-gallery) lists every screen in one place, screens.mjs. This test holds
 * that list to the app: every dialog, tab, sheet, pane, menu and shell panel component under
 * packages/ui/src/ui is either named by a screen's `covers` or listed in EXCLUDED with a reason, and
 * every name in `covers` or EXCLUDED is a component that exists. A new screen nobody pictured, or a
 * deleted one still claimed, fails here.
 */
import {describe, expect, it} from 'vitest';
import {readdirSync, readFileSync} from 'node:fs';
import {basename, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {EXCLUDED, SCREENS} from '../../../../scripts/ui-gallery/screens.mjs';

const UI = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'ui');

function vueFiles(dir: string): string[] {
  return readdirSync(dir, {withFileTypes: true}).flatMap(e =>
    e.isDirectory() ? vueFiles(join(dir, e.name)) : e.name.endsWith('.vue') ? [join(dir, e.name)] : []);
}

const ALL = vueFiles(UI);
const NAMES = new Set(ALL.map(f => basename(f, '.vue')));

const NAMED_LIKE_A_SCREEN = /(Dialog|Modal|Tab|Bar|Sheet|Pane|Menu|Screen|Banner|Browser|Shell|Library|Inspector|Step|Panel|View)$/;
const RENDERS_A_SCREEN = /role="(alert|alert)?dialog"|role="menu"|role="alert"|<Teleport/;
// Every top-level component of a shell is a screen, panel or tab of it.
const IN_A_SHELL = /[\\/]shells[\\/](mobile|original)[\\/][^\\/]+\.vue$/;

function looksLikeAScreen(file: string): boolean {
  return NAMED_LIKE_A_SCREEN.test(basename(file, '.vue')) || IN_A_SHELL.test(file) || RENDERS_A_SCREEN.test(readFileSync(file, 'utf8'));
}

const SCREEN_COMPONENTS = ALL.filter(looksLikeAScreen).map(f => basename(f, '.vue')).sort();
interface GalleryScreen { readonly key: string; readonly vp: readonly string[]; readonly covers: readonly string[] }
const SCREEN_LIST: readonly GalleryScreen[] = SCREENS;
const EXCLUSIONS: readonly (readonly [string, string])[] = Object.entries<string>(EXCLUDED);
const COVERED = new Set(SCREEN_LIST.flatMap(s => s.covers));
const EXCLUDED_NAMES = EXCLUSIONS.map(([name]) => name);

describe('architecture: the UI gallery covers every screen', () => {
  it('finds the screen components it is meant to hold to the list', () => {
    expect(SCREEN_COMPONENTS.length).toBeGreaterThan(25);
    expect(SCREEN_COMPONENTS).toContain('DriverEditorModal');
    expect(SCREEN_COMPONENTS).toContain('MobileSheet');
  });

  it('every dialog, tab, sheet and shell panel is pictured or excluded with a reason', () => {
    const missed = SCREEN_COMPONENTS.filter(n => !COVERED.has(n) && !EXCLUDED_NAMES.includes(n));
    expect(missed, `add a screen to scripts/ui-gallery/screens.mjs naming these in covers, or list them in EXCLUDED with a reason: ${missed.join(', ')}`).toEqual([]);
  });

  it('every screen names the components it shows, and each exists', () => {
    const bad = SCREEN_LIST.flatMap(s =>
      s.covers.length === 0 ? [`${s.key}: covers nothing`] : s.covers.filter(n => !NAMES.has(n)).map(n => `${s.key}: no component ${n}`));
    expect(bad).toEqual([]);
  });

  it('every exclusion names a component that exists, gives a reason, and is not also pictured', () => {
    const bad = EXCLUSIONS.flatMap(([n, reason]) =>
      [...(NAMES.has(n) ? [] : [`${n}: no such component`]), ...(reason.trim() === '' ? [`${n}: no reason`] : []), ...(COVERED.has(n) ? [`${n}: excluded but pictured`] : [])]);
    expect(bad).toEqual([]);
  });

  it('a screen key is not listed twice for the same viewport', () => {
    const seen = new Set<string>();
    const dup: string[] = [];
    for (const s of SCREEN_LIST) for (const vp of s.vp) {
      const id = `${vp}-${s.key}`;
      if (seen.has(id)) dup.push(id);
      seen.add(id);
    }
    expect(dup).toEqual([]);
  });
});
