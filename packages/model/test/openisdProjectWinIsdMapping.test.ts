/**
 * `OpenISDProject`'s WinISD-facing surface: the box-type code<->kind mapping (PLAN_QO60_
 * LAYERING_REMEDIATION.md objective 2b — the ONE place `[Box].BType` maps to `AlignmentKind`),
 * the live `.driver` accessor, and `fromWinISDProject` — the ONE place a raw `.wpr` parse
 * becomes a real project (objective 2b/3).
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  OpenISDProject, WinIsdBType, alignmentKindOfBType, bTypeOfAlignmentKind,
} from '../src/openisdProject.js';
import { OpenISDDriver } from '../src/openisdDriver.js';

describe('alignmentKindOfBType / bTypeOfAlignmentKind — the one BType<->AlignmentKind mapping', () => {
  it('maps every WinISD code to its AlignmentKind and back', () => {
    assert.equal(alignmentKindOfBType(WinIsdBType.Sealed), 'sealed');
    assert.equal(alignmentKindOfBType(WinIsdBType.Vented), 'vented');
    assert.equal(alignmentKindOfBType(WinIsdBType.Bandpass4), 'bandpass4');
    assert.equal(alignmentKindOfBType(WinIsdBType.PassiveRadiator), 'passive-radiator');
    assert.equal(bTypeOfAlignmentKind('sealed'), WinIsdBType.Sealed);
    assert.equal(bTypeOfAlignmentKind('vented'), WinIsdBType.Vented);
    assert.equal(bTypeOfAlignmentKind('bandpass4'), WinIsdBType.Bandpass4);
    assert.equal(bTypeOfAlignmentKind('passive-radiator'), WinIsdBType.PassiveRadiator);
  });
  it('is undefined for a code WinISD does not model, or absent', () => {
    assert.equal(alignmentKindOfBType(3), undefined);
    assert.equal(alignmentKindOfBType(undefined), undefined);
  });
});

describe('OpenISDProject.setDriver — adopts a driver into this project as a record clone', () => {
  it('a fresh project holds no driver text', () => {
    assert.equal(OpenISDProject.empty().driverText(), undefined);
  });
  it('a driver adopted via setDriver reads back off the project\'s own stored text', () => {
    const project = OpenISDProject.empty();
    const driver = OpenISDDriver.empty();
    driver.enter('Fs', 111111);
    project.setDriver(driver);
    const text = project.driverText();
    assert.ok(text, 'setDriver must store the driver\'s own serialisation');
    assert.equal(OpenISDDriver.fromOwdrText(text!).cell('Fs').value, 111111);
  });
});

/** A raw parse with every sub-object present but empty — matches what `parseWprRaw` always
 *  hands back (only LEAF fields are optional); a test overrides just the fields it cares about. */
function emptyRaw(overrides: { bType: number | undefined; box?: Record<string, number> }) {
  return {
    bType: overrides.bType,
    driverWdrText: '',
    box: overrides.box ?? {},
    signal: {},
    ventFront: {},
    ventRear: {},
    simulatorOptions: {},
    environment: {},
    passiveRadiator: {},
    projectInfo: {},
  };
}

describe('OpenISDProject.fromWinISDProject — the one place raw .wpr data becomes a project', () => {
  it('sets the active alignment from BType and carries the sealed volume across', () => {
    const project = OpenISDProject.fromWinISDProject(emptyRaw({
      bType: WinIsdBType.Sealed, box: { Vr: 222222e-6 },
    }));
    assert.equal(project.box.active, 'sealed');
    assert.equal(project.box.sealed.volume_m3, 222222e-6);
  });
  it('throws when BType is absent — never guesses a box type', () => {
    assert.throws(() => OpenISDProject.fromWinISDProject(emptyRaw({ bType: undefined })));
  });
  it('throws when BType names a code OpenISD does not model', () => {
    assert.throws(() => OpenISDProject.fromWinISDProject(emptyRaw({ bType: 3 })));
  });
});
