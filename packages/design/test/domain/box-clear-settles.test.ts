import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {NumberField} from '@openisd/design/fields';
import {WINISD_BOX_LOSSES} from '../../domain/boxDefaults.js';
import {STARTING_SHARED_VOLUME_M3, startingChambersOf} from '../../domain/box/startingChambers.js';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

/** John, 2026-10-16 (bugs/BUG_20261009_pr-added-mass-can-be-cleared-to-blank.md): a cleared box
 *  volume settles, entered, to the volume the box's current alignment gives — the same figure
 *  `applyStartingValues`/`resetVentedAlignment` write for that box type; a cleared loss Q settles
 *  to the WinISD default the box starts with; a field allowed to stay empty (a filter value) can
 *  be asked "is this field empty while it is allowed to be". */
describe('clearing a box volume settles it to the alignment volume', () => {
  const driver = { Fs_hz: 30, Qes: 0.4, Qms: 4, Sd_m2: 0.02, Cms_m_per_N: 0.0005 };
  const vented = () =>
    new ProjectBuilder(driverFromSpec(createEngine(), driver), createEngine())
      .vented().volume_m3(0.03).tuning_goal_hz(30).build();
  const pr = () =>
    new ProjectBuilder(driverFromSpec(createEngine(), driver), createEngine())
      .passiveRadiator().volume_m3(0.02).build();
  const bp4 = () =>
    new ProjectBuilder(driverFromSpec(createEngine(), driver), createEngine())
      .bandpass4().rearVolume_m3(0.02).frontVolume_m3(0.015).frontTuning_hz(30).build();
  const bp6 = () =>
    new ProjectBuilder(driverFromSpec(createEngine(), driver), createEngine())
      .bandpass6().rearVolume_m3(0.05).frontVolume_m3(0.04).build();
  const abc = () =>
    new ProjectBuilder(driverFromSpec(createEngine(), driver), createEngine())
      .abc().rearVolume_m3(0.05).frontVolume_m3(0.04).build();

  it('a cleared vented volume is entered, at the QB3 alignment volume', () => {
    const p = vented();
    const design = p.driver.ventedDesign('qb3', p.Rs_ohm.value, p.box.vented.losses.Ql.value)!;

    p.box.vented.volume_m3.clear();

    expect(p.box.vented.volume_m3.entered).toBe(true);
    expect(p.box.vented.volume_m3.value).toBe(design.Vb);
  });

  it('a cleared passive-radiator volume is entered, at the starting shared volume', () => {
    const p = pr();
    p.box.passiveRadiator.volume_m3.set(0.05);

    p.box.passiveRadiator.volume_m3.clear();

    expect(p.box.passiveRadiator.volume_m3.entered).toBe(true);
    expect(p.box.passiveRadiator.volume_m3.value).toBe(STARTING_SHARED_VOLUME_M3);
  });

  it('a cleared bandpass4 rear volume is entered, at the starting rear volume', () => {
    const p = bp4();

    p.box.bandpass4.chambers.rear.volume_m3.clear();

    expect(p.box.bandpass4.chambers.rear.volume_m3.entered).toBe(true);
    expect(p.box.bandpass4.chambers.rear.volume_m3.value).toBe(startingChambersOf('bandpass4').rearVolume_m3);
  });

  it('a cleared bandpass4 front volume is entered, at the starting front volume', () => {
    const p = bp4();

    p.box.bandpass4.chambers.front.volume_m3.clear();

    expect(p.box.bandpass4.chambers.front.volume_m3.entered).toBe(true);
    expect(p.box.bandpass4.chambers.front.volume_m3.value).toBe(startingChambersOf('bandpass4').frontVolume_m3);
  });

  it('a cleared bandpass6 rear volume is entered, at the starting rear volume', () => {
    const p = bp6();

    p.box.bandpass6.chambers.rear.volume_m3.clear();

    expect(p.box.bandpass6.chambers.rear.volume_m3.entered).toBe(true);
    expect(p.box.bandpass6.chambers.rear.volume_m3.value).toBe(startingChambersOf('bandpass6').rearVolume_m3);
  });

  it('a cleared bandpass6 front volume is entered, at the starting front volume', () => {
    const p = bp6();

    p.box.bandpass6.chambers.front.volume_m3.clear();

    expect(p.box.bandpass6.chambers.front.volume_m3.entered).toBe(true);
    expect(p.box.bandpass6.chambers.front.volume_m3.value).toBe(startingChambersOf('bandpass6').frontVolume_m3);
  });

  it('a cleared ABC rear volume is entered, at the starting rear volume', () => {
    const p = abc();

    p.box.abc.chambers.rear.volume_m3.clear();

    expect(p.box.abc.chambers.rear.volume_m3.entered).toBe(true);
    expect(p.box.abc.chambers.rear.volume_m3.value).toBe(startingChambersOf('abc').rearVolume_m3);
  });

  it('a cleared ABC front volume is entered, at the starting front volume', () => {
    const p = abc();

    p.box.abc.chambers.front.volume_m3.clear();

    expect(p.box.abc.chambers.front.volume_m3.entered).toBe(true);
    expect(p.box.abc.chambers.front.volume_m3.value).toBe(startingChambersOf('abc').frontVolume_m3);
  });
});

describe('clearing a loss Q settles it to the WinISD default', () => {
  const driver = { Fs_hz: 30, Qes: 0.4, Qms: 4, Sd_m2: 0.02, Cms_m_per_N: 0.0005 };
  const sealed = () =>
    new ProjectBuilder(driverFromSpec(createEngine(), driver), createEngine())
      .sealed().volume_m3(0.03).build();
  const vented = () =>
    new ProjectBuilder(driverFromSpec(createEngine(), driver), createEngine())
      .vented().volume_m3(0.03).tuning_goal_hz(30).build();
  const pr = () =>
    new ProjectBuilder(driverFromSpec(createEngine(), driver), createEngine())
      .passiveRadiator().volume_m3(0.02).build();
  const bp4 = () =>
    new ProjectBuilder(driverFromSpec(createEngine(), driver), createEngine())
      .bandpass4().rearVolume_m3(0.02).frontVolume_m3(0.015).frontTuning_hz(30).build();
  const bp6 = () =>
    new ProjectBuilder(driverFromSpec(createEngine(), driver), createEngine())
      .bandpass6().rearVolume_m3(0.05).frontVolume_m3(0.04).build();
  const abc = () =>
    new ProjectBuilder(driverFromSpec(createEngine(), driver), createEngine())
      .abc().rearVolume_m3(0.05).frontVolume_m3(0.04).build();

  it('sealed Ql and Qa', () => {
    const p = sealed();
    p.box.sealed.losses.Ql.set(50);
    p.box.sealed.losses.Qa.set(20);

    p.box.sealed.losses.Ql.clear();
    p.box.sealed.losses.Qa.clear();

    expect(p.box.sealed.losses.Ql.value).toBe(WINISD_BOX_LOSSES.Ql);
    expect(p.box.sealed.losses.Qa.value).toBe(WINISD_BOX_LOSSES.Qa);
  });

  it('vented Ql, Qa and Qp', () => {
    const p = vented();
    const losses = p.box.vented.losses;
    losses.Ql.set(50);
    losses.Qa.set(20);
    losses.Qp.set(5);

    losses.Ql.clear();
    losses.Qa.clear();
    losses.Qp.clear();

    expect(losses.Ql.value).toBe(WINISD_BOX_LOSSES.Ql);
    expect(losses.Qa.value).toBe(WINISD_BOX_LOSSES.Qa);
    expect(losses.Qp.value).toBe(WINISD_BOX_LOSSES.Qp);
  });

  it('passive-radiator Ql and Qa', () => {
    const p = pr();
    const losses = p.box.passiveRadiator.losses;
    losses.Ql.set(50);
    losses.Qa.set(20);

    losses.Ql.clear();
    losses.Qa.clear();

    expect(losses.Ql.value).toBe(WINISD_BOX_LOSSES.Ql);
    expect(losses.Qa.value).toBe(WINISD_BOX_LOSSES.Qa);
  });

  it('bandpass4 rear Ql and Qa, front Ql, Qa and Qp, and the shared Qicl', () => {
    const p = bp4();
    const {rear, front} = p.box.bandpass4.chambers;
    rear.losses.Ql.set(50);
    rear.losses.Qa.set(20);
    front.losses.Ql.set(50);
    front.losses.Qa.set(20);
    front.losses.Qp.set(5);
    p.box.bandpass4.Qiclfr.set(42);

    rear.losses.Ql.clear();
    rear.losses.Qa.clear();
    front.losses.Ql.clear();
    front.losses.Qa.clear();
    front.losses.Qp.clear();
    p.box.bandpass4.Qiclfr.clear();

    expect(rear.losses.Ql.value).toBe(WINISD_BOX_LOSSES.Ql);
    expect(rear.losses.Qa.value).toBe(WINISD_BOX_LOSSES.Qa);
    expect(front.losses.Ql.value).toBe(WINISD_BOX_LOSSES.Ql);
    expect(front.losses.Qa.value).toBe(WINISD_BOX_LOSSES.Qa);
    expect(front.losses.Qp.value).toBe(WINISD_BOX_LOSSES.Qp);
    expect(p.box.bandpass4.Qiclfr.value).toBe(WINISD_BOX_LOSSES.Qicl);
  });

  it('bandpass6 rear and front Ql, Qa and Qp, and the shared Qicl', () => {
    const p = bp6();
    for (const chamber of [p.box.bandpass6.chambers.rear, p.box.bandpass6.chambers.front]) {
      chamber.losses.Ql.set(50);
      chamber.losses.Qa.set(20);
      chamber.losses.Qp.set(5);
    }
    p.box.bandpass6.Qiclfr.set(42);

    for (const chamber of [p.box.bandpass6.chambers.rear, p.box.bandpass6.chambers.front]) {
      chamber.losses.Ql.clear();
      chamber.losses.Qa.clear();
      chamber.losses.Qp.clear();
    }
    p.box.bandpass6.Qiclfr.clear();

    for (const chamber of [p.box.bandpass6.chambers.rear, p.box.bandpass6.chambers.front]) {
      expect(chamber.losses.Ql.value).toBe(WINISD_BOX_LOSSES.Ql);
      expect(chamber.losses.Qa.value).toBe(WINISD_BOX_LOSSES.Qa);
      expect(chamber.losses.Qp.value).toBe(WINISD_BOX_LOSSES.Qp);
    }
    expect(p.box.bandpass6.Qiclfr.value).toBe(WINISD_BOX_LOSSES.Qicl);
  });

  it('ABC rear and front Ql, Qa and Qp, and the shared Qicl', () => {
    const p = abc();
    for (const chamber of [p.box.abc.chambers.rear, p.box.abc.chambers.front]) {
      chamber.losses.Ql.set(50);
      chamber.losses.Qa.set(20);
      chamber.losses.Qp.set(5);
    }
    p.box.abc.Qiclfr.set(42);

    for (const chamber of [p.box.abc.chambers.rear, p.box.abc.chambers.front]) {
      chamber.losses.Ql.clear();
      chamber.losses.Qa.clear();
      chamber.losses.Qp.clear();
    }
    p.box.abc.Qiclfr.clear();

    for (const chamber of [p.box.abc.chambers.rear, p.box.abc.chambers.front]) {
      expect(chamber.losses.Ql.value).toBe(WINISD_BOX_LOSSES.Ql);
      expect(chamber.losses.Qa.value).toBe(WINISD_BOX_LOSSES.Qa);
      expect(chamber.losses.Qp.value).toBe(WINISD_BOX_LOSSES.Qp);
    }
    expect(p.box.abc.Qiclfr.value).toBe(WINISD_BOX_LOSSES.Qicl);
  });
});

describe('a field allowed to stay empty', () => {
  it('a filter field is empty-and-allowed while blank, never while filled', () => {
    expect(NumberField.FILTER_FC_HZ.emptyAndAllowed(null)).toBe(true);
    expect(NumberField.FILTER_FC_HZ.emptyAndAllowed(50)).toBe(false);
  });

  it('a settling field is never empty-and-allowed', () => {
    expect(NumberField.BOX_VB_L.emptyAndAllowed(null)).toBe(false);
    expect(NumberField.BOX_VB_L.emptyAndAllowed(0.03)).toBe(false);
  });
});
