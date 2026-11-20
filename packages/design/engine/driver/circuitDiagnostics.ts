import {NumberField} from '../../fields/field.js';
import type {RequiredValueIssue} from '../consistency.js';
import {plainNames} from '../issueText.js';
import type {DriverValues} from '../solverTypes.js';
import type {DriverWorkingSet} from '../solvers/driverQuantities.js';
import type {DriverChartFix} from '../types.js';
import {DRIVER_ROUTES} from './routes/DriverRoutes.js';
import {BL_FROM_QES} from './routes/relations.js';
import type {RouteQuantity} from './routes/SolveRoute.js';

/** The circuit reads the terminal Re and BL. The editor shows the driver's published Re and BL. */
const CIRCUIT_FIELDS = Object.freeze([
  Object.freeze({reading: 'Sd_m2', field: 'Sd_m2'}),
  Object.freeze({reading: 'Re_terminal_ohm', field: 'Re_ohm'}),
  Object.freeze({reading: 'BL_terminal_Tm', field: 'BL_Tm'}),
  Object.freeze({reading: 'Cms_m_per_N', field: 'Cms_m_per_N'}),
  Object.freeze({reading: 'Mms_kg', field: 'Mms_kg'}),
  Object.freeze({reading: 'Rms_kg_per_s', field: 'Rms_kg_per_s'}),
] satisfies readonly {reading: RouteQuantity; field: RouteQuantity}[]);

type CircuitField = typeof CIRCUIT_FIELDS[number]['field'];
type CircuitQuantity = typeof CIRCUIT_FIELDS[number]['reading'];
type CircuitReadings = Readonly<Partial<Record<CircuitQuantity, number | null | undefined>>>;
export type ReadyCircuitReadings = Readonly<Record<CircuitQuantity, number>>;

export interface DriverCircuitFieldIssue extends RequiredValueIssue {
  readonly field: CircuitField;
}

export interface DriverCircuitIssue extends DriverCircuitFieldIssue {
  readonly chartFix: DriverChartFix;
}

/** Prefer the familiar datasheet figures when equally short repairs are possible. */
const DATASHEET_ORDER: readonly RouteQuantity[] = Object.freeze([
  'Fs_hz', 'Qes', 'Qms', 'Vas_m3', 'Re_ohm', 'Sd_m2', 'Dd_m',
]);

function positive(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function hasCircuitFields(readings: CircuitReadings): readings is ReadyCircuitReadings {
  return missingCircuitFields(readings).length === 0;
}

export function missingCircuitFields(readings: CircuitReadings): CircuitField[] {
  return CIRCUIT_FIELDS.filter(({reading}) => !positive(readings[reading])).map(({field}) => field);
}

type RepairRoute = {readonly target: RouteQuantity; readonly inputs: readonly RouteQuantity[]};

function editable(field: RouteQuantity): boolean {
  return field !== 'c_m_per_s' && field !== 'roo_kg_per_m3' && NumberField.named(field) !== undefined;
}

function tabOf(field: RouteQuantity): string {
  return field === 'EBP_hz' || field === 'Rme_kg_per_s' ? 'Advanced' : 'Parameters';
}

function label(field: RouteQuantity): string {
  return NumberField.named(field)?.label ?? plainNames(field);
}

function list(items: readonly string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

function named(field: RouteQuantity): string {
  const symbol = label(field);
  const full = plainNames(field);
  if (field === 'Dd_m') return 'Dd (cone diameter)';
  if (field === 'USPL_dB') return 'USPL (voltage sensitivity)';
  if (field === 'SPL_dB') return 'SPL (1 W sensitivity)';
  const name = full.slice(0, full.lastIndexOf(' ('));
  return full.endsWith(` (${symbol})`) ? `${symbol} (${name})` : symbol;
}

function knownValues(values: DriverValues, missing: readonly CircuitField[]): DriverWorkingSet {
  const known: DriverWorkingSet = {};
  for (const {target, inputs} of DRIVER_ROUTES) {
    for (const field of [target, ...inputs]) {
      const value = values[field];
      if (positive(value)) known[field] = value;
    }
  }
  for (const {field, reading} of CIRCUIT_FIELDS) {
    const value = values[reading];
    if (positive(value)) known[field] = value;
  }
  for (const field of missing) delete known[field];
  return known;
}

/** Include the circuit's compliance-based BL relation alongside the editor's mass-based route. */
function repairRoutes(known: DriverWorkingSet): RepairRoute[] {
  const routes = DRIVER_ROUTES.filter(route =>
    route.inputs.some(field => known[field] === undefined) ||
    positive(route.value({...known, [route.target]: undefined})),
  );
  const {target, fields, predict} = BL_FROM_QES;
  const inputs = fields.filter(field => field !== target);
  return inputs.some(field => known[field] === undefined) || positive(predict(known))
    ? [{target, inputs}, ...routes]
    : routes;
}

function fieldIssues(
  missing: readonly CircuitField[], known: DriverWorkingSet, routes: readonly RepairRoute[],
): DriverCircuitFieldIssue[] {
  return missing.map(field => {
    const alternatives = routes.filter(route => route.target === field)
      .map(route => route.inputs.filter(input => known[input] === undefined))
      .filter(inputs => inputs.length > 0 && inputs.every(editable));
    const inputs = alternatives.reduce<readonly RouteQuantity[] | undefined>((best, next) =>
      best === undefined || next.length < best.length ? next : best, undefined);
    const type = `Type ${named(field)}`;
    const text = inputs === undefined ? `${type}.` :
      `${type} if you know it, otherwise enter ${list(inputs.map(input => tabOf(input) === tabOf(field) ? named(input) : `${named(input)} in ${tabOf(input)}`))}.`;
    return {kind: 'required-value', field, text};
  });
}

/** A fix is a set of boxes to fill. Follow dependencies back from the missing circuit quantities
 *  to collect candidates, then try those sets in increasing size. Close each set forwards through
 *  the real routes so a cycle cannot supply its own starting values. */
function smallestInputs(missing: readonly CircuitField[], known: DriverWorkingSet, routes: readonly RepairRoute[]) {
  const relevant = new Set<RouteQuantity>(missing);
  for (const field of relevant) {
    if (known[field] !== undefined) continue;
    for (const route of routes) {
      if (route.target === field) route.inputs.forEach(input => relevant.add(input));
    }
  }
  // Prefer direct entry of cone area over deriving it indirectly from another quantity.
  const candidates = [...new Set<RouteQuantity>(['Sd_m2', ...DATASHEET_ORDER, ...relevant])]
    .filter(field => relevant.has(field) && known[field] === undefined && editable(field));
  const steps = routes.filter(route => relevant.has(route.target) && known[route.target] === undefined)
    .map(route => ({target: route.target, inputs: route.inputs.filter(input => known[input] === undefined)}));

  function unblocks(inputs: readonly RouteQuantity[]): boolean {
    const available = new Set(inputs);
    let previousSize = -1;
    while (available.size !== previousSize) {
      previousSize = available.size;
      for (const step of steps) {
        if (!available.has(step.target) && step.inputs.every(input => available.has(input))) available.add(step.target);
      }
    }
    return missing.every(field => available.has(field));
  }

  function search(start: number, count: number, inputs: readonly RouteQuantity[]): readonly RouteQuantity[] | null {
    if (count === 0) return unblocks(inputs) ? inputs : null;
    for (let index = start; index <= candidates.length - count; index++) {
      const found = search(index + 1, count - 1, [...inputs, candidates[index]]);
      if (found !== null) return found;
    }
    return null;
  }

  // Direct entry of every missing circuit figure is an upper bound.
  for (let count = 0; count <= missing.length; count++) {
    const inputs = search(0, count, []);
    if (inputs === null) continue;
    const displayed = [...DATASHEET_ORDER.filter(field => inputs.includes(field)),
      ...inputs.filter(field => !DATASHEET_ORDER.includes(field))];
    return displayed.map(field => {
      const substitute = routes.find(step => step.target === field && step.inputs.length === 1
        && candidates.includes(step.inputs[0]) && !inputs.includes(step.inputs[0])
        && tabOf(step.inputs[0]) === tabOf(field)
        && unblocks(inputs.map(input => input === field ? step.inputs[0] : input)));
      return {field, alternative: substitute?.inputs[0]};
    });
  }
  return missing.map(field => ({field, alternative: undefined}));
}

function fixLine(inputs: ReturnType<typeof smallestInputs>, driver: string): string {
  const editor = `${driver} > Edit`;
  if (inputs.length === 0) return `Open ${editor} and save to calculate the missing figures.`;
  const tabs = new Map<string, string[]>();
  for (const {field, alternative} of inputs) {
    const tab = tabOf(field);
    const fields = tabs.get(tab) ?? [];
    fields.push(alternative === undefined ? label(field) : `${label(field)} (or ${label(alternative)})`);
    tabs.set(tab, fields);
  }
  const groups = [...tabs].map(([tab, fields]) => `${list(fields)} in ${editor} > ${tab}`);
  return `Enter ${list(groups)}.`;
}

export function driverCircuitFieldIssues(values: DriverValues): readonly DriverCircuitFieldIssue[] {
  const missing = missingCircuitFields(values);
  if (missing.length === 0) return [];
  const known = knownValues(values, missing);
  return fieldIssues(missing, known, repairRoutes(known));
}

export function driverCircuitIssues(values: DriverValues, missing: readonly CircuitField[]): DriverCircuitIssue[] {
  const known = knownValues(values, missing);
  const routes = repairRoutes(known);
  const inputs = smallestInputs(missing, known, routes);
  const summary = missing.length === 1 ? 'The missing driver figure is' : 'Missing driver figures are';
  const chartFix: DriverChartFix = {
    desktop: fixLine(inputs, 'Driver'),
    phone: fixLine(inputs, 'Driver tab'),
    summary: `${summary} ${list(missing.map(plainNames))}.`,
  };
  return fieldIssues(missing, known, routes).map(issue => ({...issue, chartFix}));
}
