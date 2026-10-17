import {describe, expect, it} from 'vitest';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join, relative} from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const UI_SRC = join(HERE, '..', '..', 'src');
const THE_ONE_FILE = join('ui', 'components', 'UIFieldBody.vue');

/** The marks of a calculated number drawn by hand: the greyed box (desktop), the plain value span
 *  (phone), the greyed Options box. */
const HAND_BUILT_READOUT = /<NumReadout|calculated greyed|mob-field-value mob-readonly|opt-greyed/g;

/** Hand-built readouts not yet moved, by file and count. Each is a number a ReadoutFormat prints
 *  (its own digits and '—' for no value) or an Options box (step C); a count that no longer matches
 *  fails, so a converted site must be taken off this list and a new one cannot be added. */
const NOT_YET_MOVED: ReadonlyMap<string, number> = new Map([
  [join('ui', 'components', 'OptionsModal.vue'), 3],
]);

function vueFilesUnder(dir: string): string[] {
  const out: string[] = [];
  (function walk(current: string) {
    for (const name of readdirSync(current)) {
      const full = join(current, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.vue')) out.push(full);
    }
  })(dir);
  return out;
}

describe('architecture: a calculated number is shown by a readonly UIFixedField', () => {
  it('no hand-built readout outside UIFieldBody, apart from the named ones', () => {
    const found = new Map<string, number>();
    for (const file of vueFilesUnder(UI_SRC)) {
      const name = relative(UI_SRC, file);
      if (name === THE_ONE_FILE) continue;
      const hits = (readFileSync(file, 'utf8').match(HAND_BUILT_READOUT) ?? []).length;
      if (hits > 0) found.set(name, hits);
    }
    expect([...found].sort(), 'draw a calculated value with <UIFixedField readonly>').toEqual([...NOT_YET_MOVED].sort());
  });
});
