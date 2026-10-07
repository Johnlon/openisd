/**
 * bugs/BUG_20261005_winisd-vccon-editor-combo.md: WinISD saves a one-coil driver set to Series as
 * VCCon=1, so it reloads as Parallel. OpenISD writes VCCon=2 and reloads Series.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/index.js';
import {WinIsdDriverConverter} from '../../domain/winIsdDriverConverter.js';
import {VoiceCoilWiring} from '../../domain/voiceCoilWiring.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

describe('one-coil driver set to Series', () => {
  it('saves VCCon=2 in the .wdr and reloads as Series', () => {
    const engine = createEngine();
    const driver = driverFromSpec(engine, {
      Fs_hz: 30, Qes: 0.4, Qms: 4, Re_ohm: 6.4, Sd_m2: 0.0132, numVC: 1, VCCon: VoiceCoilWiring.Series,
    });
    const exported = driver.toWdrIniText();
    if (exported.value === null) throw new Error(exported.errors.map(e => e.message).join('; '));
    expect(exported.value).toMatch(/^VCCon=2\r?$/m);

    const imported = new WinIsdDriverConverter(engine).winIsdDriverToOpenIsdDriver(exported.value);
    if (imported.value === null) throw new Error(imported.errors.map(e => e.message).join('; '));
    expect(imported.value.specs.VCCon.value).toBe(VoiceCoilWiring.Series);
    expect(imported.value.specs.VCCon.entered).toBe(true);
  });
});
