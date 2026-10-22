// THIS GATE EXISTS TO CATCH THE AI. A red result is the finding: name the defect, then repair it.
// Casting past it, renaming so the matcher stops firing, adding an exemption or loosening the
// assertion are the same act under different names. See AGENTS.md "Every architecture test
// exists to catch the AI".

/**
 * Every number in the Options dialog is a `UIFixedField` row with ▲▼ step buttons, never a
 * native `<input type="number">`, a hand-built `NumInput` / `UnitToggle`, or a bound written as a
 * literal `{min, max}` in the template (bugs/BUG_20261005_no-common-ui-field-component.md, John 16 Oct).
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const OPTIONS_MODAL = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'ui', 'components', 'OptionsModal.vue');

describe('Options dialog', () => {
  const source = readFileSync(OPTIONS_MODAL, 'utf8');
  const forbidden: readonly [string, RegExp][] = [
    ['<NumInput', /<NumInput/],
    ['<UnitToggle', /<UnitToggle/],
    ['type="number"', /type\s*=\s*["']number["']/],
    ['v-limits', /v-limits/],
    ['a literal min: / max: bound', /\b(?:min|max)\s*:\s*-?\d/],
  ];
  for (const [name, pattern] of forbidden) {
    it(`draws no ${name}`, () => {
      assert.ok(!pattern.test(source), `OptionsModal.vue still has ${name}; use UIFixedField with a NumberField`);
    });
  }
});
