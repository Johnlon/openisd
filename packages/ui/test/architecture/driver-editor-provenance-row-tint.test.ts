/**
 * Inspect Provenance tints the WHOLE ROW of each field that feeds the inspected one (label, value,
 * unit), as a background tint; not the field box edge, and not the value text colour.
 * bugs/BUG_20261021_provenance-highlight-edge-only.md (John, 21 Oct 2026).
 *
 * The browser spec measures the painted row; this unit spec pins the three pieces that make it so:
 *  - the provenance data names Qes as an input of Qts (so Qes is a feeding field);
 *  - every editor field that takes a provenance style also takes the `de-feeds` class, and the
 *    feeding style is a background tint only (no border, no shadow, no text colour);
 *  - the `de-feeds` CSS stretches the field to the full width of its row cell.
 */

import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {getProvenanceInfo} from '../../src/logic/provenance.js';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '..', '..', 'src', 'ui', 'components', 'DriverEditorModal.vue'), 'utf8');

/** The body of `getFieldStyle`, up to the next top-level function. */
function feedingBranch(): string {
  const start = src.indexOf('function getFieldStyle');
  assert.ok(start >= 0, 'getFieldStyle exists');
  const body = src.slice(start, src.indexOf('\nfunction ', start + 10));
  const from = body.indexOf('path.inputs.includes(fieldKey)');
  assert.ok(from >= 0, 'getFieldStyle has a feeding-field branch');
  return body.slice(from, body.indexOf('return {', from) + body.slice(body.indexOf('return {', from)).indexOf('};') + 2);
}

describe('Inspect Provenance row tint', () => {
  it('the provenance data names Qes as an input to Qts', () => {
    const info = getProvenanceInfo('Qts');
    assert.ok(info, 'Qts has provenance');
    assert.ok(info.paths.some(p => p.inputs.includes('Qes')), 'Qes feeds Qts');
  });

  it('every field that takes a provenance style also takes the inspector row classes (de-feeds and the ƒ mark) for the same key', () => {
    const styled = [...src.matchAll(/<UIField[^>]*data-field-key="(\w+)"[^>]*:style="getFieldStyle\('(\w+)'\)"/g)];
    assert.ok(styled.length > 30, `found the styled fields (${styled.length})`);
    for (const [line, key, styleKey] of styled) {
      assert.equal(styleKey, key, `style key matches field key for ${key}`);
      assert.ok(line.includes(`inspectClass('${key}')`), `${key} takes inspectClass('${key}')`);
    }
  });

  it('the feeding style is a background tint only: no border, shadow or text colour', () => {
    const branch = feedingBranch();
    assert.match(branch, /backgroundColor:/, 'the feeding style sets a background tint');
    assert.doesNotMatch(branch, /border(Color|Width|Style)|boxShadow/, 'no coloured edge or glow');
    assert.doesNotMatch(branch, /(^|[^-\w])color:/m, 'value text colour is left alone');
  });

  it('de-feeds stretches the field across its whole row cell', () => {
    assert.match(src, /\.de-desktop \.de-fld\.de-feeds\s*\{[^}]*width:\s*100%[^}]*justify-self:\s*stretch/, 'full-width rule');
  });

  it('feedsClass returns de-feeds only for a field a path names as an input', () => {
    const fn = src.slice(src.indexOf('function feedsClass'), src.indexOf('function getFieldStyle'));
    assert.match(fn, /path\.inputs\.includes\(fieldKey\)\)\s*\?\s*'de-feeds'\s*:\s*''/);
    assert.match(fn, /fieldKey === inspectedField\.value\)\s*return ''/, 'the inspected field itself is not a feeder');
  });
});
