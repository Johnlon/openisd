// THIS GATE EXISTS TO CATCH THE AI. A red result is the finding: name the defect, then repair it.
// Casting past it, renaming so the matcher stops firing, adding an exemption or loosening the
// assertion are the same act under different names. See AGENTS.md "Every architecture test
// exists to catch the AI".

/**
 * Every number in the desktop Original shell is a `UIField` / `UIFixedField` row with ▲▼ step buttons: no
 * hand-built `<NumInput`, no `<UnitToggle` and no native `<input type="number">` in OriginalShell.vue
 * (bugs/BUG_20261005_no-common-ui-field-component.md, John 16 Oct).
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const SHELL = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'ui', 'shells', 'original', 'OriginalShell.vue');

describe('OriginalShell.vue', () => {
  it('draws no hand-built number box', () => {
    const source = readFileSync(SHELL, 'utf8');
    const found = [
      /<NumInput\b/.test(source) ? '<NumInput' : null,
      /<UnitToggle\b/.test(source) ? '<UnitToggle' : null,
      /type\s*=\s*["']number["']/.test(source) ? 'type="number"' : null,
    ].filter(hit => hit !== null);
    assert.deepEqual(found, [], 'OriginalShell.vue still draws these by hand; use UIFixedField / UIField');
  });
});
