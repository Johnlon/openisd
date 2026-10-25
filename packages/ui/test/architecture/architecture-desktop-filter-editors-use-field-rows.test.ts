// THIS GATE EXISTS TO CATCH THE AI. A red result is the finding: name the defect, then repair it.
// Casting past it, renaming so the matcher stops firing, adding an exemption or loosening the
// assertion are the same act under different names. See AGENTS.md "Every architecture test
// exists to catch the AI".

/**
 * Every number in a desktop filter editor is a `UIFixedField` row with ▲▼ step buttons, never a
 * native `<input type="number">` (bugs/BUG_20261005_no-common-ui-field-component.md, John 16 Oct).
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const FILTERS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'ui', 'shells', 'original', 'filters');

describe('desktop filter editors', () => {
  it('draw no native number box', () => {
    const vueFiles = readdirSync(FILTERS_DIR).filter(name => name.endsWith('.vue'));
    assert.ok(vueFiles.length >= 8, `expected the eight filter editors in ${FILTERS_DIR}`);
    const offenders = vueFiles.filter(name => /type\s*=\s*["']number["']/.test(readFileSync(join(FILTERS_DIR, name), 'utf8')));
    assert.deepEqual(offenders, [], 'these editors still draw type="number"; use UIFixedField');
  });
});
