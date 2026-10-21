/**
 * T520: on the phone the General tab's Comment box takes the tab's spare height. The fill is a chain
 * of CSS rules in DriverEditorModal.vue (scroll area, body, tab, field, field value, textarea); one
 * missing link leaves the box at its minimum height with blank space under it. This pins every link.
 * The browser spec driver-editor-dimensions-diagram.browser.spec.ts measures the result on screen.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../src/ui/components/DriverEditorModal.vue'), 'utf8');

describe('DriverEditorModal phone General tab fill', () => {
  const links = [
    '.de-phone .de-scroll { display: flex; flex-direction: column; }',
    '.de-phone .de-scroll > .de-body { flex: 1 0 auto !important; }',
    '.de-phone .de-general { display: flex !important; flex-direction: column !important; flex: 1 1 auto !important; height: auto !important; }',
    '.de-phone .de-general .de-fld.de-comment { display: flex; flex-direction: column; flex: 1 1 auto; }',
    '.de-phone .de-general .de-fld.de-comment > :deep(.ui-field-value) { flex: 1 1 auto; display: flex; align-items: stretch; }',
  ];
  for (const link of links) {
    it(`has the rule ${link.split(' {')[0]}`, () => {
      assert.ok(source.includes(link), `missing: ${link}`);
    });
  }
  it('lets the Comment textarea grow from a 120 px minimum', () => {
    assert.match(source, /\.de-phone \.de-general \.de-fld\.de-comment textarea \{ flex: 1 1 auto; width: 100% !important; min-height: 120px !important;/);
  });
});
