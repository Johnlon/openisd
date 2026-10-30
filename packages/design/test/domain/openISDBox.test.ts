import {describe, expect, it} from 'vitest';
import {OpenISDDriver} from '../../domain/driver/openISDDriver.js';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import type {OpenISDProject} from '../../domain/project/openISDProject.js';

type Box = OpenISDProject['box'];
import type {BoxType} from '../../engine/index.js';
import {createEngine} from '../../engine/Engine.js';

const engine = createEngine();

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function driverWith(stated: boolean): OpenISDDriver {
  const driver = OpenISDDriver.empty(engine);
  if (stated) {
    driver.specs.Fs_hz.set(40);
    driver.specs.Qes.set(0.45);
    driver.specs.Qms.set(4);
    driver.specs.Vas_m3.set(0.03);
    driver.specs.Re_ohm.set(6);
    driver.specs.Sd_m2.set(0.02);
  }
  return driver;
}

const ALL_TYPES: readonly BoxType[] = ['sealed', 'vented', 'bandpass4', 'bandpass6', 'abc', 'box-passive-radiator'];

function projectOf(type: BoxType, stated = true): OpenISDProject {
  const builder = new ProjectBuilder(driverWith(stated), engine);
  switch (type) {
    case 'sealed': return builder.sealed().volume_m3(0.02).build();
    case 'vented': return builder.vented().build();
    case 'bandpass4': return builder.bandpass4().build();
    case 'bandpass6': return builder.bandpass6().build();
    case 'abc': return builder.abc().build();
    case 'box-passive-radiator': return builder.passiveRadiator().volume_m3(0.02).build();
  }
}

describe('OpenISDBox — which port belongs to which box type', () => {
  it.each([
    {type: 'bandpass4' as const, front: (b: Box) => b.bandpass4},
    {type: 'bandpass6' as const, front: (b: Box) => b.bandpass6},
    {type: 'abc' as const, front: (b: Box) => b.abc},
  ])('$type: the vent group is the front chamber and front vent', ({type, front}) => {
    const box = projectOf(type).box;
    const group = box.ventGroupOf(type);
    expect(group.vent).toBe(front(box).vents.front);
    expect(group.volume_m3).toBe(front(box).chambers.front.volume_m3);
    expect(group.tuning_goal_hz).toBe(front(box).chambers.front.tuning_goal_hz);
  });

  it.each(['sealed', 'vented', 'box-passive-radiator'] as const)('%s: the vent group is the vented box\'s', (type) => {
    const box = projectOf(type).box;
    expect(box.ventGroupOf(type)).toBe(box.vented);
  });

  it.each([
    {type: 'bandpass6' as const, rear: (b: Box) => b.bandpass6},
    {type: 'abc' as const, rear: (b: Box) => b.abc},
  ])('$type: the rear vent group is the rear chamber and rear vent', ({type, rear}) => {
    const box = projectOf(type).box;
    const group = box.rearVentGroupOf(type);
    expect(group?.vent).toBe(rear(box).vents.rear);
    expect(group?.volume_m3).toBe(rear(box).chambers.rear.volume_m3);
  });

  it.each(['sealed', 'vented', 'bandpass4', 'box-passive-radiator'] as const)('%s has no rear vent group', (type) => {
    expect(projectOf(type).box.rearVentGroupOf(type)).toBeNull();
  });

  it.each([
    {type: 'sealed' as const, names: []},
    {type: 'box-passive-radiator' as const, names: []},
    {type: 'vented' as const, names: ['Vent']},
    {type: 'bandpass4' as const, names: ['Front']},
    {type: 'bandpass6' as const, names: ['Rear', 'Front']},
    {type: 'abc' as const, names: ['Rear', 'Front', 'Intra']},
  ])('$type has the ports $names', ({type, names}) => {
    expect(projectOf(type).box.ventPortsOf(type).map(port => port.name)).toEqual(names);
  });

  it('every box type names a volume', () => {
    for (const type of ALL_TYPES) expect(projectOf(type).box.volumeOf(type).value).not.toBeNull();
  });
});

describe('OpenISDBox — starting values', () => {
  it('a slotted port with no size gets a slot as wide as the driver and 3 cm high', () => {
    const driver = driverWith(true);
    driver.specs.Dd_m.set(0.2);
    const project = new ProjectBuilder(driver, engine).vented().build();
    project.box.vented.vent.shape.set('slotted');
    project.box.vented.vent.width_m.clear();
    project.box.vented.vent.height_m.clear();
    project.box.applyStartingValues();
    expect(project.box.vented.vent.width_m.value).toBe(0.2);
    expect(project.box.vented.vent.height_m.value).toBe(0.03);
  });

  it('a slotted port that already has a height keeps it', () => {
    const project = projectOf('vented');
    project.box.vented.vent.shape.set('slotted');
    project.box.vented.vent.height_m.set(0.05);
    project.box.vented.vent.width_m.clear();
    project.box.applyStartingValues();
    expect(project.box.vented.vent.height_m.value).toBe(0.05);
  });

  it('an ABC box with a connecting-port length keeps it', () => {
    const project = projectOf('abc');
    project.box.abc.vents.intra.length_m.set(0.07);
    project.box.applyStartingValues();
    expect(project.box.abc.vents.intra.length_m.value).toBe(0.07);
  });

  it('an ABC box with no connecting-port length gets the starting one', () => {
    const project = projectOf('abc');
    project.box.abc.vents.intra.length_m.clear();
    expect(project.box.abc.vents.intra.length_m.value).toBeNull();
    project.box.applyStartingValues();
    expect(project.box.abc.vents.intra.length_m.value).toBe(0.05);
  });

  it('a vented alignment reset on a driver with no design leaves the box as it was', () => {
    const project = projectOf('vented', false);
    const before = project.box.vented.volume_m3.value;
    project.box.resetVentedAlignment();
    expect(project.box.vented.volume_m3.value).toBe(before);
  });
});

describe('OpenISDBox — sealed volume, Qtc and Fsc', () => {
  it('a sealed box with no volume and nothing to derive one from reads blank with a mark', () => {
    const project = new ProjectBuilder(driverWith(false), engine).sealed().build();
    project.box.sealed.volume_m3.clear();
    expect(project.box.sealed.volume_m3.value).toBeNull();
    expect(project.box.sealed.volume_m3.dq.length).toBeGreaterThan(0);
  });

  it('clearing a volume that was never stated leaves it blank', () => {
    const project = new ProjectBuilder(driverWith(false), engine).sealed().build();
    project.box.sealed.volume_m3.clear();
    project.box.sealed.volume_m3.clear();
    expect(project.box.sealed.volume_m3.value).toBeNull();
    expect(project.box.sealed.q_tc.entered).toBe(false);
  });

  it('clearing a Qtc that is not the entered one changes nothing', () => {
    const project = projectOf('sealed');
    project.box.sealed.q_tc.clear();
    expect(project.box.sealed.volume_m3.value).toBe(0.02);
    expect(project.box.sealed.volume_m3.entered).toBe(true);
  });

  it('a Qtc mark written by the solver is recorded on the stored Qtc entry', () => {
    const project = projectOf('sealed');
    project.box.sealed.q_tc.set(0.7);
    const mark = engine.issues.targetUnreachable('q_tc', 0);
    project.box.sealed.q_tc.setDq([mark]);
    const stored: unknown = JSON.parse(project.toOwprText());
    const qtc = isRecord(stored) && isRecord(stored.edited) && isRecord(stored.edited.box) && isRecord(stored.edited.box.sealed)
      ? stored.edited.box.sealed.Qtc : undefined;
    expect(isRecord(qtc) ? qtc.dq_calculated : undefined).toHaveLength(1);
  });

  it('an entered Fsc cannot give a volume while the driver states no Fs, Vas or Qts', () => {
    const project = new ProjectBuilder(driverWith(false), engine).sealed().build();
    project.box.sealed.volume_m3.clear();
    project.box.sealed.resonance_hz.set(70);
    expect(project.box.sealed.volume_m3.value).toBeNull();
  });

  it('setting Fsc then clearing it hands the entry to the volume at its current value', () => {
    const project = projectOf('sealed');
    project.box.sealed.resonance_hz.set(70);
    const volume = project.box.sealed.volume_m3.value;
    expect(volume).not.toBeNull();
    project.box.sealed.resonance_hz.clear();
    expect(project.box.sealed.volume_m3.entered).toBe(true);
    expect(project.box.sealed.volume_m3.value).toBe(volume);
  });
});

describe('OpenISDBox — bandpass4 rear chamber', () => {
  it('reads its Qtc from the rear volume and the driver', () => {
    const project = projectOf('bandpass4');
    expect(project.box.bandpass4.chambers.rear.q_tc.value).toBeGreaterThan(0);
  });

  it('reads no Qtc when the driver states nothing', () => {
    const project = projectOf('bandpass4', false);
    expect(project.box.bandpass4.chambers.rear.q_tc.value).toBeNull();
  });
});

describe('OpenISDBox — passive radiator with a zero count', () => {
  it('works out the natural tuning as for one radiator', () => {
    const project = projectOf('box-passive-radiator');
    project.box.passiveRadiator.count.set(1);
    const one = project.box.passiveRadiator.naturalTuning_hz.value;
    const addedOne = project.box.passiveRadiator.addedMassForTuning_kg(60).value;
    project.box.passiveRadiator.count.set(0);
    expect(one).not.toBeNull();
    expect(project.box.passiveRadiator.naturalTuning_hz.value).toBe(one);
    expect(project.box.passiveRadiator.addedMassForTuning_kg(60).value).toBe(addedOne);
  });
});
