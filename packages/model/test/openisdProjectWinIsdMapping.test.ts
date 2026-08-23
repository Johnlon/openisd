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
import { WinISDProject } from '@openisd/winisd';
import { moistAirDensity, moistAirSoundVelocity, T_REF_K, RH_REF_PCT, P_REF_PA } from '@openisd/engine';

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

/** A minimal `.wpr` read through the real reader — fixtures are the file's own text, so a test
 *  states exactly what a file would state and nothing else. */
function wprOf(boxLines: string[]) {
  return WinISDProject.fromWprIni(['[Box]', ...boxLines, ''].join('\n'));
}

describe('OpenISDProject.fromWinISDProject — the one place raw .wpr data becomes a project', () => {
  it('sets the active alignment from BType and carries the sealed volume across', () => {
    const project = OpenISDProject.fromWinISDProject(wprOf(['BType=0', 'Vr=0.222222']));
    assert.equal(project.box.active, 'sealed');
    assert.equal(project.box.sealed.volume_m3, 222222e-6);
  });
  it('throws when BType is absent — never guesses a box type', () => {
    assert.throws(() => OpenISDProject.fromWinISDProject(wprOf(['Vr=0.02'])));
  });
  it('throws when BType names a code OpenISD does not model', () => {
    assert.throws(() => OpenISDProject.fromWinISDProject(wprOf(['BType=3'])));
  });
});

describe('OpenISDProject.toWinISDProject — the write-side twin, physics on the domain object', () => {
  const NOW = new Date(Date.UTC(2026, 0, 15));
  const DRIVER = '[Driver]\nBrand=x\nParState=EEE';

  it('entered-area provenance survives a round trip: crosscalc=0 in, crosscalc=0 out', () => {
    // The bug this pins: import used to drop the flag, and re-export wrote crosscalc=1 —
    // flipping the file's own stated provenance with no user action
    // (bugs/BUG_20260823_wpr_import_discards_vent_cross_section_provenance.md). crosscalc is
    // AREA provenance, carried through the entered set; it never touches the vent's shape.
    const project = OpenISDProject.fromWinISDProject(WinISDProject.fromWprIni([
      '[Box]', 'BType=1', 'Vr=0.02', 'Fr=45', '',
      '[VentRear]', 'Num=1', 'dia1=0.05', 'len=0.12', 'crosscalc=0', '',
    ].join('\n')));
    const out = project.toWinISDProject(DRIVER, null, NOW, null).toWpr();
    assert.match(out, /crosscalc=0/);
    assert.doesNotMatch(out.split('[VentRear]')[1]!.split('[VentIntra]')[0]!, /crosscalc=1/);
  });

  it('a round port still writes crosscalc=1', () => {
    const project = OpenISDProject.fromWinISDProject(WinISDProject.fromWprIni([
      '[Box]', 'BType=1', 'Vr=0.02', 'Fr=45', '',
      '[VentRear]', 'Num=1', 'dia1=0.05', 'len=0.12', 'crosscalc=1', '',
    ].join('\n')));
    const rear = project.toWinISDProject(DRIVER, null, NOW, null).toWpr()
      .split('[VentRear]')[1]!.split('[VentIntra]')[0]!;
    assert.match(rear, /crosscalc=1/);
  });

  it('humidity crosses percent → fraction exactly once, here', () => {
    const project = OpenISDProject.fromWinISDProject(WinISDProject.fromWprIni(
      '[Box]\nBType=0\nVr=0.02\nT=303.15\np=90000\nphi=0.8\n'));
    const out = project.toWinISDProject(DRIVER, null, NOW, null).toWpr();
    assert.match(out, /phi=0\.8/);   // record held 80 %; the file gets the fraction back
    assert.doesNotMatch(out, /phi=80/);
  });

  it('chamber losses round-trip through the per-chamber keys the file actually has', () => {
    // Import read the invented key `Ql` before this rewrite, so losses were silently never
    // imported; the real keys are Qlr/Qar/Qpr.
    //
    // Writing ONE triple into BOTH chambers pins the box model's PRESENT gap, not the
    // contract: bandpass4 has two real chambers and the model has one loss triple
    // (bugs/BUG_20260823_box_model_collapses_per_chamber_losses.md, folded into Lane P).
    const project = OpenISDProject.fromWinISDProject(WinISDProject.fromWprIni(
      '[Box]\nBType=0\nVr=0.02\nQlr=7\nQar=50\nQpr=80\n'));
    const out = project.toWinISDProject(DRIVER, null, NOW, null).toWpr();
    for (const line of ['Qlf=7', 'Qlr=7', 'Qaf=50', 'Qar=50', 'Qpf=80', 'Qpr=80']) {
      assert.ok(out.includes(line), `expected ${line}`);
    }
  });

  it('[PassiveRadiator].Vas round-trips in cubic metres, the file\'s own unit', () => {
    // Port of the deleted wprMapping.test.ts assertion (BUG_20260817: litres were written
    // into the m³ field, 1000× too large). A same-file round trip catches both directions.
    const project = OpenISDProject.fromWinISDProject(WinISDProject.fromWprIni([
      '[Box]', 'BType=4', 'Vr=0.04', 'Npr=1', '',
      '[PassiveRadiator]', 'Vas=0.0048', 'Qms=3.3', 'Fs=30', 'Sd=0.0095', 'Xmax=0.019', 'Me=0', '',
    ].join('\n')));
    const out = project.toWinISDProject(DRIVER, null, NOW, null).toWpr();
    const vas = Number(/Vas=([0-9.eE+-]+)/.exec(out)![1]);
    const relErr = Math.abs(vas - 0.0048) / 0.0048;
    assert.ok(relErr < 1e-6, `Vas must come back in m³ (~0.0048), got ${vas}`);

    // First principles, independently of every prX helper: Vas = Cms·Sd²·ρ·c², computed here
    // from the record's own derived Cms and the engine's reference air. If the writer ever
    // reverts to litres this is off by 1000×, which is exactly BUG_20260817's failure.
    const radiator = project.box.passiveRadiator.radiator!;
    const rho = moistAirDensity(T_REF_K, RH_REF_PCT, P_REF_PA);
    const c = moistAirSoundVelocity(T_REF_K, RH_REF_PCT, P_REF_PA);
    const firstPrinciples = radiator.Cms_m_per_N * radiator.Sd_m2 ** 2 * rho * c * c;
    const fpErr = Math.abs(vas - firstPrinciples) / firstPrinciples;
    assert.ok(fpErr < 1e-9,
      `Vas must equal Cms·Sd²·ρ·c² = ${firstPrinciples} m³; got ${vas}` +
      (Math.abs(vas / firstPrinciples - 1000) < 1 ? ' — 1000× off: litres written into the m³ field' : ''));
  });
});

describe('fromWinISDProject — import-side assertions against literals (a round trip cannot see a compensating error pair)', () => {
  it('crosscalc=0 marks the AREA entered on the record; shape follows the observed geometry', () => {
    const areaEntered = OpenISDProject.fromWinISDProject(WinISDProject.fromWprIni(
      '[Box]\nBType=1\nVr=0.02\n\n[VentRear]\nNum=1\ndia1=0.05\ncrosscalc=0\n'));
    assert.equal(areaEntered.target.entered['ventCrossArea'], true);
    assert.equal(areaEntered.vent(0)?.shape, 'round', 'a stated dia1 is a round port — crosscalc is not shape');

    const derived = OpenISDProject.fromWinISDProject(WinISDProject.fromWprIni(
      '[Box]\nBType=1\nVr=0.02\n\n[VentRear]\nNum=1\ndia1=0.05\ncrosscalc=1\n'));
    assert.equal(derived.target.entered['ventCrossArea'], undefined);
    assert.equal(derived.vent(0)?.shape, 'round');
  });

  it('Qlr/Qar/Qpr land on the record as the box losses', () => {
    const project = OpenISDProject.fromWinISDProject(WinISDProject.fromWprIni(
      '[Box]\nBType=0\nVr=0.02\nQlr=7\nQar=50\nQpr=80\n'));
    assert.equal(project.box.Ql, 7);
    assert.equal(project.box.Qa, 50);
    assert.equal(project.box.Qp, 80);
  });

  it('Npr lands on the record as the radiator count', () => {
    const project = OpenISDProject.fromWinISDProject(WinISDProject.fromWprIni([
      '[Box]', 'BType=4', 'Vr=0.04', 'Npr=2', '',
      '[PassiveRadiator]', 'Vas=0.0048', 'Qms=3.3', 'Fs=30', 'Sd=0.0095', '',
    ].join('\n')));
    assert.equal(project.box.passiveRadiator.count, 2);
  });

  it('Nd lands on the record as the driver count', () => {
    const project = OpenISDProject.fromWinISDProject(WinISDProject.fromWprIni(
      '[Box]\nBType=0\nVr=0.02\nNd=3\n'));
    assert.equal(project.signal.driverCount, 3);
  });
});

describe('crosscalc is AREA provenance, never port shape (opus2 H1, interim ruling pending the WinISD probe)', () => {
  const NOW = new Date(Date.UTC(2026, 0, 15));
  const DRIVER = '[Driver]\nBrand=x\nParState=EEE';

  it('no import may build a vent whose area is zero while the file states a nonzero dia1', () => {
    const project = OpenISDProject.fromWinISDProject(WinISDProject.fromWprIni(
      '[Box]\nBType=1\nVr=0.02\nFr=45\n\n[VentRear]\nNum=1\ndia1=0.05\nlen=0.12\ncrosscalc=0\n'));
    const vent = project.vent(0)!;
    // Shape comes from OBSERVED GEOMETRY: a stated dia1 is a round port. The file has no
    // width/height keys, so shape='slotted' here would force area = 0·0 = 0.
    assert.equal(vent.shape, 'round');
    assert.equal(vent.diameter_m, 0.05);
    const area = Math.PI * (0.05 / 2) ** 2;
    const out = project.toWinISDProject(DRIVER, null, NOW, null).toWpr();
    const rear = out.split('[VentRear]')[1]!.split('[VentIntra]')[0]!;
    const carea = Number(/carea=([0-9.eE+-]+)/.exec(rear)![1]);
    assert.ok(Math.abs(carea - area) / area < 1e-9,
      `carea must be the real port area ${area}, got ${carea} — zero means the import invented a zero-area vent`);
  });

  it('crosscalc=0 is held as entered area provenance and round-trips without touching shape', () => {
    const project = OpenISDProject.fromWinISDProject(WinISDProject.fromWprIni(
      '[Box]\nBType=1\nVr=0.02\nFr=45\n\n[VentRear]\nNum=1\ndia1=0.05\nlen=0.12\ncrosscalc=0\n'));
    assert.equal(project.target.entered['ventCrossArea'], true);
    const rear = project.toWinISDProject(DRIVER, null, NOW, null).toWpr()
      .split('[VentRear]')[1]!.split('[VentIntra]')[0]!;
    assert.match(rear, /crosscalc=0/);
  });

  it('crosscalc=1 leaves the entered set alone and writes crosscalc=1 back', () => {
    const project = OpenISDProject.fromWinISDProject(WinISDProject.fromWprIni(
      '[Box]\nBType=1\nVr=0.02\nFr=45\n\n[VentRear]\nNum=1\ndia1=0.05\nlen=0.12\ncrosscalc=1\n'));
    assert.equal(project.target.entered['ventCrossArea'], undefined);
    const rear = project.toWinISDProject(DRIVER, null, NOW, null).toWpr()
      .split('[VentRear]')[1]!.split('[VentIntra]')[0]!;
    assert.match(rear, /crosscalc=1/);
  });
});
