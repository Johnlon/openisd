import {describe, expect, it} from 'vitest';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join, relative} from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const UI_SRC = join(HERE, '..', '..', 'src');
const THE_ONE_FILE = join('ui', 'components', 'UIFieldBody.vue');

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
  it('<NumReadout> is used only inside UIFieldBody', () => {
    const offences = vueFilesUnder(UI_SRC)
      .filter(f => relative(UI_SRC, f) !== THE_ONE_FILE)
      .filter(f => readFileSync(f, 'utf8').includes('<NumReadout'))
      .map(f => relative(UI_SRC, f));
    expect(offences, 'draw a calculated value with <UIFixedField readonly>, not a hand-built row').toEqual([]);
  });
});
