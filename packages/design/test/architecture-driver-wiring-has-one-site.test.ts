// THIS GATE EXISTS TO CATCH THE AI. A red result is the finding: name the defect in a sentence and
// repair it, or STOP and report. Never rename, exempt or loosen to make it pass.
// See AGENTS.md "Every architecture test exists to catch the AI".

/**
 * Driver wiring has ONE site (plan docs/plans/PLAN_20261116_DRIVER_WIRING.md section 5.1, ticket Johnlon/openisd#519):
 * `driverDrive` in `engine/array/driverWiring.ts` is the only place that turns an amplifier voltage and Rg into what each of
 * the N drivers sees, as PR 137's gate does for coil wiring (`architecture-coil-wiring-arithmetic-has-one-site.test.ts`).
 *
 * This gate: in non-test sources `driverDrive` and `amplifierVoltage` are named only by the engine's sweep and signal
 * solve; the "Impedance of one driver" switch is read at exactly one place, the sweep's impedance line; and driver wiring
 * and coil wiring never read each other's inputs.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join, relative} from 'node:path';

const PACKAGES = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROOTS = [join(PACKAGES, 'design'), join(PACKAGES, 'ui', 'src'), join(PACKAGES, 'persistence', 'src')];
const SKIPPED_DIRS = new Set(['node_modules', 'test', 'dist', 'build']);

function sourcesUnder(dir: string): string[] {
  return readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    if (entry.isDirectory()) return SKIPPED_DIRS.has(entry.name) ? [] : sourcesUnder(join(dir, entry.name));
    return /\.(ts|vue)$/.test(entry.name) ? [join(dir, entry.name)] : [];
  });
}

const SOURCES = ROOTS.flatMap(sourcesUnder).map(file => ({file: relative(PACKAGES, file).split('\\').join('/'), text: readFileSync(file, 'utf8')}));
const named = (word: RegExp) => SOURCES.filter(s => word.test(s.text)).map(s => s.file).sort();
const source = (file: string) => {
  const found = SOURCES.find(s => s.file === file);
  assert.ok(found, `${file} does not exist`);
  return found.text;
};

const DRIVER_WIRING = 'design/engine/array/driverWiring.ts';

describe('driver wiring arithmetic', () => {
  it('driverDrive and amplifierVoltage are named only where they are defined, in the sweep and in the signal solve', () => {
    const allowed = [DRIVER_WIRING, 'design/engine/signal/SignalEngine.ts', 'design/engine/simulation/SimulationEngine.ts'];
    assert.deepEqual(named(/\b(?:driverDrive|amplifierVoltage)\b/), allowed);
  });

  it('the sweep reads the "Impedance of one driver" switch once, in its impedance line, and no other source reads it', () => {
    const reads = SOURCES.filter(s => /\bwinisdOneDriverImpedance\b/.test(s.text) && s.file !== 'design/engine/types.ts');
    assert.deepEqual(reads.map(s => s.file), ['design/engine/simulation/SimulationEngine.ts']);
    assert.equal(source('design/engine/simulation/SimulationEngine.ts').match(/P\.winisdOneDriverImpedance/g)?.length, 1);
  });

  it('the load scale is applied only by the sweep, to the impedance magnitude', () => {
    assert.deepEqual(named(/\bloadScale\b/), [DRIVER_WIRING, 'design/engine/simulation/SimulationEngine.ts']);
  });

  it('driver wiring never reads the coil wiring inputs, and the coil conversion never reads the driver wiring', () => {
    assert.doesNotMatch(source(DRIVER_WIRING), /numVC|VCCon|convertWiring|terminalMotor|Re_terminal|BL_terminal/);
    assert.doesNotMatch(source('design/engine/solvers/driverQuantities.ts'), /driverWiring|driverDrive|DriverWiring|DriverDrive|nDrivers/);
  });
});
