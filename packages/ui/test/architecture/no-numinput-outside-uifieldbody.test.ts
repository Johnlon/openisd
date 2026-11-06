// THIS GATE EXISTS TO CATCH THE AI. A red result is the finding: name the defect, then repair it.
// Casting past it, renaming so the matcher stops firing, adding an exemption or loosening the
// assertion are the same act under different names. See AGENTS.md "Every architecture test
// exists to catch the AI".

/**
 * Every number box on every screen is drawn by the one shared field component, `UIFieldBody.vue`:
 * no other .vue under packages/ui/src renders `<NumInput` (bugs/archive/BUG_20261005_no-common-ui-field-component.md).
 *
 * A count the person picks from a list (number of drivers, vents, radiators) is a number box too:
 * UIFieldBody draws it as a select when the field's editor is `NumberEditor.CountSelect`. A hand-built
 * `<select>` whose options are a NumberField's `countOptions()` (or the *_COUNT_OPTIONS / N_DRIVERS_OPTIONS
 * built from it) is the same fork. (John, 5 Nov 2026: "ALL SCREENS USE THE COMMON COMPONENT".)
 *
 * Not detectable here, and so not gated: a free-text `<input>` that holds a number but has no
 * NumberField behind it (the chart cursor Hz box, the Driver Library min/max filter boxes). Text
 * boxes for names and dates are also `<input type="text">`, so no rule on the tag can tell them apart.
 */
import {describe, expect, it} from 'vitest';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join, relative} from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const UI_SRC = join(HERE, '..', '..', 'src');
const THE_ONE_FILE = join('ui', 'components', 'UIFieldBody.vue');
/** The phone port editor keeps its hand-built Number of Vents dropdown: John ruled it stays as it is (QO426.c53). */
const JOHN_RULED_STAYS = join('ui', 'components', 'VentPortFields.vue');
/** The desktop port columns keep their hand-built Number dropdown for this release: John ruled that what the test site serves stays (6 Nov 2026). The common-field version is on branch t690-port-row. */
const DESKTOP_PORTS_STAY_THIS_RELEASE = join('ui', 'shells', 'original', 'OriginalShell.vue');

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

  it('no .vue other than UIFieldBody hand-builds a <select> over a NumberField count', () => {
    const selectBlock = /<select\b[\s\S]*?<\/select>/g;
    const countOptions = /\bcountOptions\(|\b(?:N_DRIVERS|VENT_COUNT|PR_COUNT)_OPTIONS\b/;
    const found = vueFilesUnder(UI_SRC)
      .map(file => relative(UI_SRC, file))
      .filter(name => name !== THE_ONE_FILE && name !== JOHN_RULED_STAYS && name !== DESKTOP_PORTS_STAY_THIS_RELEASE)
      .filter(name => (readFileSync(join(UI_SRC, name), 'utf8').match(selectBlock) ?? []).some(block => countOptions.test(block)));
    expect(found, 'draw a count with UIField / UIFixedField over a NumberEditor.CountSelect field').toEqual([]);
  });
});
