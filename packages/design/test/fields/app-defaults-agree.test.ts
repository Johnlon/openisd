import {describe, expect, it} from 'vitest';
import {createEngine, DEFAULT_VENTED_DESIGN_LIMITS} from '@openisd/design/engine';
import {
  DEFAULT_NEW_PROJECT_QA, DEFAULT_NEW_PROJECT_QICL, DEFAULT_NEW_PROJECT_QICLFR, DEFAULT_NEW_PROJECT_QP,
  DEFAULT_SEALED_QTC, DEFAULT_SEALED_VOLUME_L, DEFAULT_SWEEP_POINTS, DEFAULT_VENTED_ALIGNMENT,
  END_CORRECTION_OPTIONS, NumberField, PhoneDialogHelp, SEALED_ALIGNMENT_OPTIONS,
} from '@openisd/design/fields';
import {DEFAULT_P_REF_PA} from '../../engine/air.js';
import {portLoss} from '../../engine/boxes/port.js';
import {FrequencyAxis} from '../../chart/axis.js';
import {emptyBoxJson, WINISD_BOX_LOSSES} from '../../domain/boxDefaults.js';
import {startingChambersOf} from '../../domain/box/startingChambers.js';
import {OpenISDPassiveRadiatorStandalone} from '../../domain/passiveRadiator/openISDPassiveRadiatorStandalone.js';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {fixedAppContext} from '../fixtures/domainBuilders.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';
import {sweepDriver, solveConsistencyGroup} from '../engine/testSolver.js';
import {REFERENCE_AIR} from '../fixtures/referenceAir.js';

/** T726 (bugs/BUG_20261108_app-defaults-typed-in-many-places.md): each app default has one home,
 *  and every place that used to retype it reads that home. */
const EMPTY_RADIATOR = () => OpenISDPassiveRadiatorStandalone.empty(fixedAppContext('r')).clonePassiveRadiator();

describe('app defaults agree', () => {
  const driver = {Fs_hz: 30, Qes: 0.4, Qms: 4, Sd_m2: 0.02, Cms_m_per_N: 0.0005};

  it('a first-use vented box starts at the wizard alignment (C4), not QB3', () => {
    const p = new ProjectBuilder(driverFromSpec(createEngine(), driver), createEngine())
      .vented().volume_m3(0.03).tuning_goal_hz(30).build();
    p.box.vented.volume_m3.clear();
    const design = p.driver.ventedDesign(DEFAULT_VENTED_ALIGNMENT, p.Rs_ohm.value, p.box.vented.losses.Ql.value)!;
    expect(p.box.vented.volume_m3.value).toBe(design.Vb);
  });

  it('the shared starting chamber volume is the one sealed default (7 L)', () => {
    expect(DEFAULT_SEALED_VOLUME_L).toBe(7);
    expect(startingChambersOf('bandpass4').rearVolume_m3).toBe(NumberField.BOX_VB_L.toSI(DEFAULT_SEALED_VOLUME_L));
  });

  it('the sealed Qtc default is the 0.707 option', () => {
    expect(SEALED_ALIGNMENT_OPTIONS.map(o => o.value)).toContain(DEFAULT_SEALED_QTC);
  });

  it('the vented plausibility band never exceeds the Vb the box accepts', () => {
    expect(DEFAULT_VENTED_DESIGN_LIMITS.maxVb_m3).toBeLessThanOrEqual(NumberField.BOX_VB_L.toSI(NumberField.BOX_VB_L.limits.max));
  });

  it('the plot start and end limits come from the one frequency axis range', () => {
    expect(NumberField.PLOT_FMIN_HZ.limits).toEqual(NumberField.PLOT_FREQ_AXIS_HZ);
    expect(NumberField.PLOT_FMAX_HZ.limits).toEqual(NumberField.PLOT_FREQ_AXIS_HZ);
  });

  it('a chart drag cannot take the axis past the plot limits', () => {
    const wide = new FrequencyAxis(100, 1000);
    expect(wide.drag('zoomLo', -50)!.fmin).toBeCloseTo(NumberField.PLOT_FMIN_HZ.limits.min, 6);
    expect(wide.drag('zoomHi', 50)!.fmax).toBeCloseTo(NumberField.PLOT_FMAX_HZ.limits.max, 6);
  });

  it('a sweep with no range or point count uses the app default range and points', () => {
    const DRV = solveConsistencyGroup({Fs_hz: 37, Qts: 0.38, Qes: 0.4, Qms: 7, Vas_m3: 0.03, Sd_m2: 0.0133, Re_ohm: 5.6, Xmax_m: 0.005, Pe_W: 60, Znom_ohm: 8});
    const {fs} = createEngine().simulation.sweep(sweepDriver(DRV), 0.7e-3, 'sealed', {Vb: 0.03, Ql: 1e9, eg: 2.83, air: REFERENCE_AIR}).values!;
    expect(fs[0]).toBe(NumberField.PLOT_RANGE_DEFAULT_HZ.min);
    expect(fs[fs.length - 1]).toBeCloseTo(NumberField.PLOT_RANGE_DEFAULT_HZ.max, 6);
    expect(fs.length).toBe(DEFAULT_SWEEP_POINTS + 1);
  });

  it('the box Q defaults are one set of constants in the box record and the engine', () => {
    expect(WINISD_BOX_LOSSES.Qp).toBe(DEFAULT_NEW_PROJECT_QP);
    expect(WINISD_BOX_LOSSES.Qicl).toBe(DEFAULT_NEW_PROJECT_QICL);
    expect(emptyBoxJson(EMPTY_RADIATOR()).bandpass4.Qiclfr).toBe(DEFAULT_NEW_PROJECT_QICLFR);
    expect(portLoss(1, 1, {})).toBe(1 / DEFAULT_NEW_PROJECT_QP);
    expect(DEFAULT_NEW_PROJECT_QA).toBe(100);
  });

  it('a new box vent starts on the end-correction options', () => {
    const box = emptyBoxJson(EMPTY_RADIATOR());
    expect(box.vented.vent.endCorrection_m).toBe(END_CORRECTION_OPTIONS[0]!.value);
    expect(box.bandpass6.rearVent.endCorrection_m).toBe(END_CORRECTION_OPTIONS[1]!.value);
  });

  it('the environment help names the air defaults', () => {
    expect(PhoneDialogHelp.OPTIONS_ENVIRONMENT.intro).toContain('20 °C, 30 %');
    expect(PhoneDialogHelp.OPTIONS_ENVIRONMENT.rows.map(r => r.text).join(' ')).toContain(`${DEFAULT_P_REF_PA} Pa`);
  });

  it('the listening distance is at least 0.1 m and positive (QO461)', () => {
    expect(NumberField.SIGNAL_DISTANCE_M.limits.min).toBe(0.1);
    expect(NumberField.SIGNAL_DISTANCE_M.floor).toBe('positive');
  });
});
