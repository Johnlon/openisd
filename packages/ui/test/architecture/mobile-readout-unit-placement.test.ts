import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const STYLE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'style.css');

describe('architecture — mobile readouts share the standard value width', () => {
  it('keeps the unit at the standard value edge instead of stretching into the button track', () => {
    const source = readFileSync(STYLE, 'utf8');
    const plainValue = source.match(/\.mob-classic\s+\.mob-ui-field\.ui-field\s+\.ui-field-value\s*>\s*\.mob-readonly\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(plainValue).toMatch(/margin-right:\s*var\(--mob-col-stepper\)\s*;/);
    expect(source).not.toMatch(/\.ui-field-readout\s+\.ui-field-value\s*>\s*\.mob-readonly\s*\{\s*margin-right:\s*0\s*;/);
  });
});
