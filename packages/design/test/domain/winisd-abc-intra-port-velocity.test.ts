/**
 * "Enable WinISD style simplified ABC intra-port velocity" (`winisdAbcIntraPortVelocity`): on by default (WinISD's chart),
 * an option (not a WinISD bug), saved with the project, applicable on an ABC box only.
 * Sizes are from the abc-w5-1 capture (bugs/BUG_20261003_winisd-abc-intra-port-velocity-drops-ricl.md).
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/index.js';
import {OpenISDProject} from '../../domain/index.js';
import {reproduceWinisdBugs} from '../fixtures/domainBuilders.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';

const here = dirname(fileURLToPath(import.meta.url));
const engine = createEngine();

function abcProject(): OpenISDProject {
  const text = readFileSync(join(here, '..', 'winisd', 'fixtures', 'abc-w5-1.wpr'), 'utf8');
  const {value, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
  if (value === null) throw new Error('import failed: ' + JSON.stringify(errors));
  reproduceWinisdBugs(value);
  value.rgAtDriverSide.set(false);
  return value;
}

describe('winisdAbcIntraPortVelocity', () => {
  it('is on (WinISD) in a freshly imported project and a new project', () => {
    const text = readFileSync(join(here, '..', 'winisd', 'fixtures', 'abc-w5-1.wpr'), 'utf8');
    const {value} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
    expect(value!.winisdAbcIntraPortVelocity.value).toBe(true);
  });


  it('is saved with the project and read back', () => {
    const p = abcProject();
    p.winisdAbcIntraPortVelocity.set(false);
    const back = OpenISDProject.fromOwprText(p.toOwprText(), engine);
    if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
    expect(back.winisdAbcIntraPortVelocity.value).toBe(false);
  });
});
