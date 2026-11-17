// THIS GATE EXISTS TO CATCH THE AI. A red result is the finding: name the defect in a sentence and
// repair it, or STOP and report. Never rename, exempt or loosen to make it pass.
// See AGENTS.md "Every architecture test exists to catch the AI".

/**
 * The coil-wiring arithmetic has ONE site (John, QO942.c29: "I want to know that there isn't calc logic all over the
 * place"). The factors for a driver's coil wiring (Re and BL by N squared and N, `numVC` coils) live in `convertWiring`
 * in `engine/solvers/driverQuantities.ts`. The driver's entered values and its measured wiring go to the solver together
 * with the project's coil wiring; the amplifier-side Re and BL are CALCULATED at that moment, by `terminalMotor()`, the
 * one door. Nothing is copied or stored ("it's not a copy it's just a calc").
 *
 * This gate: in non-test sources, `convertWiring` is named only where it is defined, listed on the driver area, called by
 * `terminalMotor()` and called by the "can it be rewired" probe in `projectCoilWiring.ts`; and the simulation engine
 * and the circuit hold no wiring arithmetic at all.
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

const ALLOWED_NAMING_CONVERT_WIRING = new Set([
  'design/engine/solvers/driverQuantities.ts',       // the one function
  'design/engine/driver/DriverEngine.ts',            // lists it on the driver area
  'design/domain/driver/openIsdDriverSpec.ts',       // terminalMotor(): the one door
  'design/domain/project/projectCoilWiring.ts',      // the "can it be rewired" probe
]);

/** Two other places multiply by the coil count, and neither is the amplifier-side conversion: both turn a figure printed
 *  PER COIL into the figure for the wiring the maker measured in (the published figure). They are named here so that a
 *  third cannot appear unseen; the lead reports them to John (QO942.c29). */
const PER_COIL_TO_PUBLISHED = new Set([
  'design/domain/driverRecordConverter.ts',   // the bridge: a printed per-coil Re, BL or Znom stated for the measured wiring
  'design/domain/multiCoilAsPublished.ts',    // the one-time schema 3 to 4 upgrade of saved per-coil figures
]);

describe('coil-wiring arithmetic', () => {
  it('convertWiring is named only at its definition, on the driver area, in terminalMotor() and in the rewire probe', () => {
    const found = SOURCES.filter(s => /\bconvertWiring\b/.test(s.text)).map(s => s.file);
    const stray = found.filter(f => !ALLOWED_NAMING_CONVERT_WIRING.has(f));
    assert.deepEqual(stray, [], `a second site names convertWiring: ${stray.join(', ')}`);
  });

  it('no factor of the coil count squared, or its inverse, appears outside the one function', () => {
    const COIL_FACTOR = /numVC\s*\*\s*numVC|numVC\s*\*\*\s*2|Math\.pow\(\s*numVC|[\w)\]]\s*\/\s*numVC\b|[\w)\]]\s*\*\s*numVC\b/;
    const stray = SOURCES.filter(s => s.file !== 'design/engine/solvers/driverQuantities.ts' && !PER_COIL_TO_PUBLISHED.has(s.file) && COIL_FACTOR.test(s.text)).map(s => s.file);
    assert.deepEqual(stray, [], `coil-wiring arithmetic outside convertWiring: ${stray.join(', ')}`);
  });

  it('the simulation engine and the circuit hold no wiring arithmetic: no series or parallel branch, no conversion, no terminal motor', () => {
    const WIRING_ARITHMETIC = /['"](?:series|parallel)['"]|convertWiring|terminalMotor|\bwiring\s*===|\bseries\b\s*\?/;
    const stray = SOURCES.filter(s => /^design\/engine\/(simulation\/|circuit\.ts)/.test(s.file) && WIRING_ARITHMETIC.test(s.text)).map(s => s.file);
    assert.deepEqual(stray, [], `wiring arithmetic in the engine's simulation: ${stray.join(', ')}`);
  });
});
