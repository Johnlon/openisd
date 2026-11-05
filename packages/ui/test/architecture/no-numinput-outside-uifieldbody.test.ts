// THIS GATE EXISTS TO CATCH THE AI. A red result is the finding: name the defect, then repair it.
// Casting past it, renaming so the matcher stops firing, adding an exemption or loosening the
// assertion are the same act under different names. See AGENTS.md "Every architecture test
// exists to catch the AI".

/**
 * Every number box on every screen is drawn by the one shared field component, `UIFieldBody.vue`:
 * no other .vue under packages/ui/src renders `<NumInput` (bugs/archive/BUG_20261005_no-common-ui-field-component.md).
 */
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

describe('architecture: a number box is drawn only by UIFieldBody', () => {
  it('no .vue other than UIFieldBody renders <NumInput', () => {
    const found = vueFilesUnder(UI_SRC)
      .map(file => relative(UI_SRC, file))
      .filter(name => name !== THE_ONE_FILE)
      .filter(name => /<NumInput\b/.test(readFileSync(join(UI_SRC, name), 'utf8')));
    expect(found, 'draw a number with UIField / UIFixedField / UISettlingField').toEqual([]);
  });
});
