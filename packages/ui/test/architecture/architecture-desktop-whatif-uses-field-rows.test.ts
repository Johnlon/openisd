// THIS GATE EXISTS TO CATCH THE AI. A red result is the finding: name the defect, then repair it.
// Casting past it, renaming so the matcher stops firing, adding an exemption or loosening the
// assertion are the same act under different names. See AGENTS.md "Every architecture test
// exists to catch the AI".

/**
 * Every number in the desktop What-if panel is a `UIField` row with ▲▼ step buttons, never a bare
 * `NumInput` or a native `<input type="number">` (bugs/BUG_20261005_no-common-ui-field-component.md, John 16 Oct).
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const WHAT_IF = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'ui', 'shells', 'original', 'OriginalWhatIf.vue');

describe('desktop What-if panel', () => {
  const source = readFileSync(WHAT_IF, 'utf8');

  it('draws no native number box', () => {
    assert.doesNotMatch(source, /type\s*=\s*["']number["']/, 'the What-if panel draws type="number"; use UIField');
  });

  it('builds no number field from a bare NumInput', () => {
    assert.doesNotMatch(source, /NumInput/, 'the What-if panel uses NumInput directly; use UIField');
  });
});
