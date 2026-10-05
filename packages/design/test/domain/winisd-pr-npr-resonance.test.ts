/**
 * "Enable WinISD PR Npr resonance bug" (`winisdPrNprResonance`): off by default, saved
 * with the project, applicable on a passive radiator box only. Parity with WinISD's charts at
 * Npr > 1 needs it ticked (passive-radiator-count-winisd.test.ts).
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/index.js';
import {OpenISDProject} from '../../domain/index.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';

const here = dirname(fileURLToPath(import.meta.url));
const engine = createEngine();

function prProject(file: string): OpenISDProject {
  const text = readFileSync(join(here, '..', 'winisd', 'fixtures', file), 'utf8');
  const {value, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
  if (value === null) throw new Error('import failed: ' + JSON.stringify(errors));
  value.winisdDriverModel.set(true);
  value.rgAtDriverSide.set(false);
  return value;
}

describe('winisdPrNprResonance', () => {
  it('is off in a freshly imported project', () => {
    expect(prProject('pr-w5-npr-1.wpr').winisdPrNprResonance.value).toBe(false);
  });


  it('is saved with the project', () => {
    const p = prProject('pr-w5-npr-1.wpr');
    p.winisdPrNprResonance.set(true);
    const back = OpenISDProject.fromOwprText(p.toOwprText(), engine);
    if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
    expect(back.winisdPrNprResonance.value).toBe(true);
  });
});
