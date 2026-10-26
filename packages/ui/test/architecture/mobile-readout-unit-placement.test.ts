import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const STYLE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'style.css');

describe('architecture — mobile readouts do not reserve a stepper column', () => {
  it('puts the unit at the readout edge and gives a plain readout the full value width', () => {
    const source = readFileSync(STYLE, 'utf8');
    const unit = source.match(/\.mob-classic\s+\.mob-ui-field\.ui-field\.ui-field-readout\s+\.ui-field-unit\s*\{([^}]*)\}/)?.[1] ?? '';
    const plainValue = source.match(/\.mob-classic\s+\.mob-ui-field\.ui-field\.ui-field-readout\s+\.ui-field-value\s*>\s*\.mob-readonly\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(unit, 'a readout unit must override the editable field stepper offset').toMatch(/margin-right:\s*1px\s*;/);
    expect(plainValue, 'a plain readout must not reserve space for absent steppers').toMatch(/margin-right:\s*0\s*;/);
  });
});
