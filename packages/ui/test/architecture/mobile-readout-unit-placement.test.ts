import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const STYLE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'style.css');

/** A classic phone row's insets come from one tail variable: the ▲▼ column on an editable row, 1 px on a
 *  readout, so a readout's unit chip sits at the box edge and its value takes the full width. The placement
 *  itself is measured by phone-classic-rows.browser.spec.ts; this pins the contract in the stylesheet. */
describe('architecture — mobile readouts do not reserve a stepper column', () => {
  it('a readout row sets the tail to 1 px, and the unit and the plain readout both place by the tail', () => {
    const source = readFileSync(STYLE, 'utf8');
    const rule = (selector: string) => source.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
    const readoutRow = rule(String.raw`\.mob-classic\s+\.mob-ui-field\.ui-field\.ui-field-readout`);
    const unit = rule(String.raw`\.mob-classic\s+\.mob-ui-field\.ui-field\s+\.ui-field-unit`);
    const plainValue = rule(String.raw`\.mob-classic\s+\.mob-ui-field\.ui-field\s+\.ui-field-value\s*>\s*\.mob-readonly`);

    expect(readoutRow, 'a readout row has no ▲▼ tail').toMatch(/--mob-tail:\s*1px\s*;/);
    expect(unit, 'the unit chip sits by the tail').toMatch(/margin-right:\s*var\(--mob-tail\)\s*;/);
    expect(plainValue, 'a plain readout keeps the width up to the tail').toMatch(/margin-right:\s*calc\(var\(--mob-tail\)\s*-\s*1px\)\s*;/);
  });
});
