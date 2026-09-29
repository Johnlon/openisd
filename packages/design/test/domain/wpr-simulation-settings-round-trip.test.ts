/**
 * The WinISD settings a `.wpr` simulates with — `[Box]` Nd, Med, Isobarik, alfaVC, dTVC and
 * `[SimulatorOptions]` VCInd, FlatResponse, TLPorts — survive import into their OpenISD fields and
 * export back. bugs/BUG_20260926_wpr-import-drops-source-resistance-and-simulator-options.md.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/index.js';
import {OpenISDProject} from '../../domain/index.js';

const WPR_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'winisd', 'fixtures', 'sealed-w5-dtvc20.wpr');
const engine = createEngine();

/** The capture's own project with every simulation setting moved off WinISD's default. */
const SETTINGS_TEXT = readFileSync(WPR_PATH, 'utf8')
  .replace(/^Nd=1$/m, 'Nd=2').replace(/^Med=0$/m, 'Med=0.005').replace(/^Isobarik=0$/m, 'Isobarik=1')
  .replace(/^alfaVC=0.0039$/m, 'alfaVC=0.0042').replace(/^dTVC=20$/m, 'dTVC=35')
  .replace(/^VCInd=0$/m, 'VCInd=1').replace(/^FlatResponse=0$/m, 'FlatResponse=1').replace(/^TLPorts=0$/m, 'TLPorts=1');

function imported(text: string): OpenISDProject {
  const {value, errors} = OpenISDProject.fromWprText(text, engine);
  if (value === null) throw new Error('fromWprText returned problems: ' + JSON.stringify(errors));
  return value;
}

function key(text: string, section: string, name: string): string | undefined {
  const body = text.split(`[${section}]`)[1]?.split(/\n\[/)[0] ?? '';
  return new RegExp(`^${name}=(.*)$`, 'm').exec(body)?.[1]?.trim();
}

describe('.wpr simulation settings import into their OpenISD fields', () => {
  const p = imported(SETTINGS_TEXT);
  it('[Box] Nd → nDrivers', () => expect(p.nDrivers.value).toBe(2));
  it('[Box] Med → driverAddedMass_kg', () => expect(p.driverAddedMass_kg.value).toBe(0.005));
  it('[Box] Isobarik → loading', () => expect(p.loading.value).toBe('isobaric'));
  it('[Box] alfaVC → alfaVC_per_K', () => expect(p.alfaVC_per_K.value).toBe(0.0042));
  it('[Box] dTVC → vcTempRise_K', () => expect(p.vcTempRise_K.value).toBe(35));
  it('[SimulatorOptions] VCInd=1 → voice coil inductance on', () => expect(p.circuitModel.value).not.toBe('winisd'));
  it('[SimulatorOptions] FlatResponse → forceFlatResponse', () => expect(p.forceFlatResponse.value).toBe(true));
  it('[SimulatorOptions] TLPorts → useTransmissionLinePortModel', () => expect(p.useTransmissionLinePortModel.value).toBe(true));
});

describe('.wpr simulation settings export back', () => {
  const {value: wpr} = imported(SETTINGS_TEXT).toWprText();
  const text = wpr!;
  it.each([
    ['Box', 'Nd', 2], ['Box', 'Med', 0.005], ['Box', 'Isobarik', 1], ['Box', 'alfaVC', 0.0042], ['Box', 'dTVC', 35],
    ['SimulatorOptions', 'VCInd', 1], ['SimulatorOptions', 'FlatResponse', 1], ['SimulatorOptions', 'TLPorts', 1],
  ] as const)('[%s] %s = %s', (section, name, want) => {
    expect(Number(key(text, section, name))).toBe(want);
  });
});

describe('.wpr with WinISD defaults imports as OpenISD defaults', () => {
  const p = imported(readFileSync(WPR_PATH, 'utf8').replace(/^dTVC=20$/m, 'dTVC=0'));
  it('one driver, standard loading, inductance, flat response and TL ports off', () => {
    expect([p.nDrivers.value, p.loading.value, p.circuitModel.value, p.forceFlatResponse.value, p.useTransmissionLinePortModel.value])
      .toEqual([1, 'standard', 'winisd', false, false]);
  });
});
