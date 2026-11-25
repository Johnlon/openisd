import type {TabId} from './tabId.js';
import type {OpenISDProject} from '@openisd/design';

export interface ProblemDestination {
  readonly tab: TabId | 'chart';
  readonly field: string;
}

/** The desktop input for a project field, where one exists. */
export function projectProblemFieldId(destination: ProblemDestination, portCount: number): string | null {
  const fieldIds: Record<string, string> = {
    'box.volume': 'og-box-volume', 'box.frontVolume': 'og-front-volume',
    'box.rearTuning': 'og-rear-tuning', 'box.frontTuning': 'og-ffc-target', 'box.ventTuning': 'og-fb-target',
    'enclosure.count': 'og-pr-count', 'enclosure.tuning': 'og-pr-fp', 'enclosure.addedMass': 'og-pr-madd',
    'driver.project.nDrivers': 'og-ndrivers',
    'signal.power': 'og-signal-power', 'signal.voltage': 'og-signal-voltage', 'signal.resistance': 'og-signal-resistance',
    'advanced.temperature': 'og-air-temperature', 'advanced.humidity': 'og-air-humidity',
    'advanced.pressure': 'og-air-pressure', 'advanced.soundSpeed': 'og-air-sound-speed',
    'advanced.airDensity': 'og-air-density',
  };
  const direct = fieldIds[`${destination.tab}.${destination.field}`];
  if (direct) return direct;
  if (destination.tab === 'box' && destination.field.startsWith('losses.')) {
    const [, chamber, loss] = destination.field.split('.');
    if (chamber && loss) return `og-losses-${chamber}-${loss.toLowerCase()}`;
  }
  if (destination.tab !== 'enclosure') return null;
  const [port, field] = destination.field.split('.');
  if (!port || !field || !['Vent', 'Rear', 'Front', 'Intra'].includes(port)) return null;
  const suffix = port.toLowerCase();
  if (field === 'tuning') return portCount === 1 ? 'og-vent-fb-target' : `og-vent-tuning-${suffix}`;
  if (field === 'length_m') return portCount === 1 ? 'og-vent-length' : `og-vent-length-${suffix}`;
  if (field === 'count') return portCount === 1 ? 'vent-count' : `og-vent-count-${suffix}`;
  const dimension: Record<string, string> = {diameter_m: 'diameter', width_m: 'width', height_m: 'height'};
  return dimension[field] ? `og-vent-${dimension[field]}-${suffix}` : null;
}

export interface ProblemMark {
  readonly issue: {readonly kind: string; readonly text: string; readonly target?: string};
  readonly destination: ProblemDestination;
}

/** Resolve chart diagnostics to project fields when the chart names a known input. */
export function chartProblemDestination(field: string, fields: readonly {readonly destination: ProblemDestination}[]): ProblemDestination {
  const fromField = fields.find(mark => mark.destination.field === field);
  if (fromField) return fromField.destination;
  const known: Readonly<Record<string, ProblemDestination>> = {
    Vb: {tab: 'box', field: 'volume'}, Vf: {tab: 'box', field: 'frontVolume'},
    prSd: {tab: 'enclosure', field: 'radiator.Sd_m2'},
    prCms: {tab: 'enclosure', field: 'radiator.Cms_m_per_N'},
    prMmd: {tab: 'enclosure', field: 'radiator.Mms_kg'},
    prNum: {tab: 'enclosure', field: 'count'}, prMadd: {tab: 'enclosure', field: 'addedMass'},
    eg: {tab: 'signal', field: 'voltage'}, c: {tab: 'advanced', field: 'soundSpeed'},
    rho: {tab: 'advanced', field: 'airDensity'},
    maxspl: {tab: 'driver', field: 'Pe_W'}, maxpwr: {tab: 'driver', field: 'Pe_W'},
    nDrivers: {tab: 'driver', field: 'project.nDrivers'}, Rs: {tab: 'signal', field: 'resistance'},
    Fb: {tab: 'box', field: 'ventTuning'}, Ff: {tab: 'box', field: 'frontTuning'},
    Fr: {tab: 'box', field: 'rearTuning'}, SpIntra: {tab: 'enclosure', field: 'Intra.area_m2'},
    LeffIntra: {tab: 'enclosure', field: 'Intra.length_m'},
    Ql: {tab: 'box', field: 'losses.whole.Ql'}, Qa: {tab: 'box', field: 'losses.whole.Qa'},
    Qp: {tab: 'box', field: 'losses.whole.Qp'}, Qlr: {tab: 'box', field: 'losses.rear.Ql'},
    Qar: {tab: 'box', field: 'losses.rear.Qa'}, Qpr: {tab: 'box', field: 'losses.rear.Qp'},
    Qlf: {tab: 'box', field: 'losses.front.Ql'}, Qaf: {tab: 'box', field: 'losses.front.Qa'},
    Qpf: {tab: 'box', field: 'losses.front.Qp'}, Qiclfr: {tab: 'box', field: 'losses.rear.Qicl'},
  };
  return known[field] ?? {tab: 'chart', field};
}

export interface ProjectProblem {
  readonly kind: string;
  readonly text: string;
  readonly destinations: ProblemDestination[];
}

export interface ProblemField {
  readonly cell: {readonly dq: readonly ProblemMark['issue'][]};
  readonly destination: ProblemDestination;
}

/** Read the live marks from the supplied project fields. */
export function marksForProblemFields(fields: readonly ProblemField[]): ProblemMark[] {
  return fields.flatMap(({cell, destination}) => cell.dq.map(issue => ({issue, destination})));
}

function isProblemCell(value: unknown): value is ProblemField['cell'] {
  if (typeof value !== 'object' || value === null || !('dq' in value) || !Array.isArray(value.dq)) return false;
  return value.dq.every((issue: unknown) => typeof issue === 'object' && issue !== null &&
    'kind' in issue && typeof issue.kind === 'string' && 'text' in issue && typeof issue.text === 'string');
}

/** Project fields and their desktop destinations. Only the active enclosure is inspected. */
export function projectProblemFields(project: OpenISDProject): ProblemField[] {
  const result: ProblemField[] = [];
  function add(cell: ProblemField['cell'], tab: TabId, field: string): void {
    result.push({cell, destination: {tab, field}});
  }
  for (const [field, cell] of Object.entries(project.driver.specs)) {
    if (isProblemCell(cell)) add(cell, 'driver', field);
  }
  const boxType = project.box.boxType.value;
  add(project.box.volumeOf(boxType), 'box', 'volume');
  const frontVolume = project.box.frontVolumeOf(boxType);
  if (frontVolume !== null) add(frontVolume, 'box', 'frontVolume');
  const rearTuning = project.box.rearTuningOf(boxType);
  if (rearTuning !== null) add(rearTuning, 'box', 'rearTuning');
  for (const port of project.box.ventPortsOf(boxType)) {
    if (port.tuning_goal_hz !== null) add(port.tuning_goal_hz, 'enclosure', `${port.name}.tuning`);
    for (const [name, cell] of Object.entries(port.vent)) {
      if (port.vent.shape.value === 'round' && (name === 'width_m' || name === 'height_m')) continue;
      if (port.vent.shape.value === 'slotted' && name === 'diameter_m') continue;
      if (isProblemCell(cell)) add(cell, 'enclosure', `${port.name}.${name}`);
    }
  }
  if (boxType === 'box-passive-radiator') {
    const radiator = project.box.passiveRadiator;
    add(radiator.tuning_goal_hz, 'enclosure', 'tuning');
    add(radiator.addedMass_kg, 'enclosure', 'addedMass');
    for (const [field, cell] of Object.entries(radiator.radiator.spec)) {
      if (isProblemCell(cell)) add(cell, 'enclosure', `radiator.${field}`);
    }
  }
  add(project.powerDrive_W, 'signal', 'power');
  add(project.driveVoltage_V, 'signal', 'voltage');
  add(project.envTempK, 'advanced', 'temperature');
  add(project.envHumidityPct, 'advanced', 'humidity');
  add(project.envPressurePa, 'advanced', 'pressure');
  add(project.envC_m_per_s, 'advanced', 'soundSpeed');
  add(project.envRoo_kg_per_m3, 'advanced', 'airDensity');
  return result;
}

/** A single issue can mark several fields. Preserve each destination, but count the shared issue
 * once. Independent range problems remain separate even when their text is equal. */
export function collectProjectProblems(marks: readonly ProblemMark[]): ProjectProblem[] {
  const problems: ProjectProblem[] = [];
  const shared = new Map<ProblemMark['issue'], ProjectProblem>();
  for (const {issue, destination} of marks) {
    const existing = shared.get(issue);
    if (existing) {
      if (!existing.destinations.some(item => item.tab === destination.tab && item.field === destination.field)) {
        if (issue.target && destination.field.split('.').at(-1) === issue.target) existing.destinations.unshift(destination);
        else existing.destinations.push(destination);
      }
      continue;
    }
    const problem = {kind: issue.kind, text: issue.text, destinations: [destination]};
    problems.push(problem);
    shared.set(issue, problem);
  }
  return problems;
}
