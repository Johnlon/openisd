/**
 * `openisd.yml` → `winisd.wdr` projection — the entry point `winisd_tools` calls in-process
 * (embedded V8) to generate the `.wdr` it stores in `winisd_drivers`.
 *
 * Spec: `docs/spec/SPEC_ENGINE.md` §4.7. The governing requirement, restated because it
 * decides every line below: **the output must be what WinISD itself would have written if a
 * human had typed the datasheet into the driver editor and exported.** Hence
 *
 *   (a) a FIXED 56-field set — an unsupplied field gets its default, never omission;
 *   (b) every derivable field CALCULATED before writing, as WinISD's UI populates them;
 *   (c) WinISD's own constants (c, roo) and, where the choice arises, its lossy model.
 *
 * 🔒 The oracle is `drivers/sample/winisd/` (johnl, out of WinISD). An oracle `.wdr` is one
 * WinISD ITSELF wrote — a third-party database's export of driver data into `.wdr` shape is
 * NOT an oracle however plausible it looks, and neither is `winisd_drivers/…/winisd.wdr`
 * (produced by the Python writer this replaces — 16 fields short of a real save).
 *
 * This does NOT reuse `classic/wdr.ts`'s `toWdr()`: that is a different, partial dialect
 * serving a different caller (a driver authored in the OpenISD UI). Two writers exist
 * because two formats exist, not because one is a variant of the other.
 */
import { deriveOpenISDFields } from './openisdDerive.js';
import { fromYaml } from './openisdYaml.js';
import { winningReading } from './openisdRecord.js';
import { PARSTATE_LEN, POS_TO_WDRKEY } from '../parstate.js';
import type { OpenISDRecord, SpecSection, SpecEntry } from './openisdRecord.js';
import type { DriverError, Result } from '@openisd/engine';

/**
 * The 56 lines a genuine WinISD save contains, in order — the seven header strings, the
 * 48 numerics, and ParState. Source of truth:
 * `drivers/sample/winisd/john-all-defaults.wdr` (New → Save, nothing typed).
 */

/** Numeric keys in file order, each with the value WinISD writes when nothing is set. */
const NUMERIC_DEFAULTS: ReadonlyArray<readonly [string, number]> = [
  ['Qts', 0], ['Znom', 0], ['Fs', 0], ['Pe', 0], ['SPL', 0], ['Re', 0], ['Le', 0],
  ['fLe', 0], ['KLe', 0], ['BL', 0], ['Xmax', 0], ['Cms', 0], ['Qms', 0], ['Qes', 0],
  ['Rms', 0], ['Mms', 0], ['Sd', 0], ['Vas', 0], ['Dia', 0], ['Vd', 0], ['no', 0],
  ['Dd', 0], ['EBP', 0], ['numVC', 1], ['Hc', 0], ['Hg', 0], ['SPLmax', 0],
  ['SPLmaxLF', 0], ['USPL', 0], ['alfaVC', 0], ['Rt', 0], ['Ct', 0], ['gamma', 0],
  ['Rme', 0], ['Mpow', 0], ['Mcost', 0], ['Gloss', 0], ['VCCon', 1],
  // WinISD's own environment constants — written on every save, never 0.
  ['c', 343.684120962152], ['roo', 1.20095217714682],
  ['Thick', 0], ['Depth', 0], ['MagDepth', 0], ['Magnet', 0], ['Basket', 0],
  ['Outer', 0], ['Vcd', 0], ['DVol', 0],
];

/**
 * `openisd.yml` spec-field name → `.wdr` key, with the unit conversion the projection owes.
 * The record stores dimensions in mm and volume in litres; WinISD stores SI.
 */
const SPEC_TO_WDR: ReadonlyArray<readonly [keyof SpecSection, string, number]> = [
  ['Fs', 'Fs', 1], ['Re', 'Re', 1], ['Le', 'Le', 1], ['fLe', 'fLe', 1], ['KLe', 'KLe', 1],
  ['Znom', 'Znom', 1], ['Qts', 'Qts', 1], ['Qes', 'Qes', 1], ['Qms', 'Qms', 1],
  ['Vas', 'Vas', 1], ['Sd', 'Sd', 1], ['BL', 'BL', 1], ['Mms', 'Mms', 1],
  ['Cms', 'Cms', 1], ['Rms', 'Rms', 1], ['Xmax', 'Xmax', 1], ['Pe', 'Pe', 1],
  ['SPL', 'SPL', 1], ['Dd', 'Dd', 1], ['EBP', 'EBP', 1],
  ['numVC', 'numVC', 1], ['VCCon', 'VCCon', 1],
  ['voice_coil_dia_mm', 'Vcd', 1e-3], ['Hg_mm', 'Hg', 1e-3], ['Hc_mm', 'Hc', 1e-3],
  ['thick_mm', 'Thick', 1e-3], ['depth_mm', 'Depth', 1e-3],
  ['magnet_depth_mm', 'MagDepth', 1e-3], ['magnet_dia_mm', 'Magnet', 1e-3],
  ['basket_dia_mm', 'Basket', 1e-3], ['outer_dia_mm', 'Outer', 1e-3],
  ['driver_volume_l', 'DVol', 1e-3],
];

/** Engine derivation output name → `.wdr` key, where the two spell it differently. */
const DERIVED_TO_WDR: Readonly<Record<string, string>> = {
  Bl: 'BL', Z: 'Znom', c: 'c', roo: 'roo',
};

const err = (field: string, message: string): DriverError =>
  ({ level: 'error', field, message });

/** Which `specs:` section a record's `driver_type` selects. */
function sectionFor(record: OpenISDRecord): SpecSection | null {
  const t = record.driver_type?.value;
  if (t === 'passive_radiator') return record.specs?.passive_radiator ?? null;
  if (t === 'tweeter') return record.specs?.tweeter ?? null;
  // Everything else (woofer, subwoofer, midrange, full-range…) lives in `woofer`.
  return record.specs?.woofer ?? null;
}

/**
 * WinISD writes plain JS-style numbers: `0`, `1`, `343.684120962152`, `6.45e-05`. Not
 * fixed-decimal, not rounded — the stored double's shortest round-trip form, which is what
 * `String(n)` already produces.
 */
const fmt = (n: number): string => String(n);

/**
 * Project one `openisd.yml` record's text into `winisd.wdr` text.
 *
 * Never throws — malformed YAML, or YAML that is not an OpenISD record, comes back as
 * `{value: null, errors}`, because a thrower cannot usefully cross an embedded-V8 boundary.
 */
export function openisdYamlToWdr(yamlText: string): Result<string> {
  let record: OpenISDRecord;
  try {
    record = fromYaml(yamlText);
  } catch (e) {
    return { value: null, errors: [err('yaml', `could not parse openisd.yml: ${String(e)}`)] };
  }
  if (record == null || typeof record !== 'object') {
    return { value: null, errors: [err('yaml', 'openisd.yml did not parse to a record')] };
  }

  const section = sectionFor(record);
  if (section == null) {
    return {
      value: null,
      errors: [err('specs', 'record carries no specs section for its driver_type — not an OpenISD record')],
    };
  }

  // ── 1. Flatten the record's entered spec values to flat SI numbers ────────────────────
  // A SpecEntry's number is reachable ONLY at readings[origin].read_value; there is no flat
  // value to fall back on (AD-8).
  const entered: Record<string, number> = {};
  const enteredWdrKeys = new Set<string>();
  const intake: DriverError[] = [];
  for (const [specKey, wdrKey, scale] of SPEC_TO_WDR) {
    const entry = section[specKey] as SpecEntry | undefined;
    if (entry?.origin == null || entry.readings == null) continue;  // genuinely absent ⇒ N
    let v: number;
    try {
      v = winningReading(entry).read_value;
    } catch {
      // The record is malformed: `origin` names a source with no reading under it. Dropping
      // to N is the only safe action — there is no value to carry and fabricating one would
      // invent data — but it is a DISCARD and must be annotated, never silent.
      intake.push({ level: 'warn', field: wdrKey,
        message: `${specKey}: origin "${entry.origin}" has no reading — field dropped to N with its WinISD default` });
      continue;
    }
    if (typeof v !== 'number' || !isFinite(v)) {
      intake.push({ level: 'warn', field: wdrKey,
        message: `${specKey}: read_value is ${String(v)}, not a finite number — field dropped to N with its WinISD default` });
      continue;
    }
    // A zero IS written and marked E (R2: mechanical — present means entered, whatever the
    // value). But a zero T/S parameter is almost always a bad scrape rather than a real
    // measurement, so the caller is told. Suppressing it here would hide a record defect
    // that belongs upstream in the record's DQ marks. See QO17.
    if (v === 0) {
      intake.push({ level: 'warn', field: wdrKey,
        message: `${specKey}: entered value is 0 — written as an entered 0; verify this is real and not a failed extraction` });
    }
    entered[wdrKey] = v * scale;
    enteredWdrKeys.add(wdrKey);
  }

  // ── 2. Calculate everything derivable (SPEC_ENGINE §4.7 obligation b) ─────────────────
  // The solver speaks the engine's names, so translate in and back out.
  const solverIn: Record<string, number> = {};
  for (const k in entered) solverIn[k === 'BL' ? 'Bl' : k === 'Znom' ? 'Z' : k] = entered[k];
  const { fields: solved, errors: solverErrors } = deriveOpenISDFields(solverIn);

  // `deriveOpenISDFields` answers TWO questions: what can be solved, and is this driver
  // SIMULATABLE. This projection asks only the first. Its `error`-level results are all of
  // the form "Fs/Re/Sd/Vas/Qts is required" — true statements about the record's
  // completeness, but not failures of the transformation: R3 defines an incomplete record
  // as the N-with-defaults case, and a record with NOTHING set projects to exactly
  // `drivers/sample/winisd/john-all-defaults.wdr`, which WinISD itself writes on New→Save.
  // So they are reported at `warn` — the caller still learns the record is thin, and still
  // gets its file. Blocking here would refuse to write a file WinISD is happy to write.
  const errors: DriverError[] = [
    ...intake,
    ...solverErrors.map(e =>
      e.level === 'error'
        ? { ...e, level: 'warn' as const, message: `${e.message} — written as N with its WinISD default` }
        : e),
  ];

  const computed: Record<string, number> = {};
  for (const k in solved) {
    const wdrKey = DERIVED_TO_WDR[k] ?? k;
    if (typeof solved[k] === 'number' && isFinite(solved[k])) computed[wdrKey] = solved[k];
  }
  // Fields WinISD shows that the T/S solver does not produce.
  if (computed.EBP == null && computed.Fs > 0 && computed.Qes > 0)
    computed.EBP = computed.Fs / computed.Qes;
  if (computed.Dia == null && computed.Dd != null) computed.Dia = computed.Dd;

  // c/roo are WinISD's OWN stored constants and are never recomputed here. The engine's
  // RHO/C are the same physical quantities rounded for the simulator (343.68 / 1.20095),
  // so letting the solver's copies through would write 343.68 where every genuine save
  // holds 343.684120962152 — a value difference, not a formatting one. NUMERIC_DEFAULTS
  // carries the WinISD figures; drop the solver's.
  delete computed.c;
  delete computed.roo;

  // ── 3. Emit the fixed field set ──────────────────────────────────────────────────────
  const s = (v: string | undefined): string => v ?? '';
  const lines: string[] = ['[Driver]'];
  lines.push(
    'Brand=' + s(record.brand?.value),
    'Model=' + s(record.model?.value),
    'Manufacturer=' + s(record.manufacturer?.value),
    'ProvidedBy=',
    'Comment=' + s(record.description?.value),
    'DateAdded=',
    'DateModified=',
  );
  for (const [key, dflt] of NUMERIC_DEFAULTS) {
    const v = entered[key] ?? computed[key] ?? dflt;
    lines.push(`${key}=${fmt(v)}`);
  }
  lines.push('ParState=' + parState(enteredWdrKeys, computed));
  lines.push('');

  return { value: lines.join('\n'), errors };
}

/**
 * Build the 49-slot state string: `E` where the record asserted the value, `C` where this
 * projection computed one, `N` where neither. Slot→key map is `parstate.ts` (probe-confirmed
 * against `drivers/sample/winisd/`).
 *
 * `numVC` is `E` on an empty record and `c`/`roo` are `C` — matching `john-all-defaults.wdr`,
 * whose ParState is N everywhere else.
 */
function parState(enteredKeys: ReadonlySet<string>, computed: Readonly<Record<string, number>>): string {
  const slots = new Array<string>(PARSTATE_LEN).fill('N');
  for (let pos = 0; pos < PARSTATE_LEN; pos++) {
    const key = POS_TO_WDRKEY[pos];
    if (key == null) continue;
    if (key === 'numVC') { slots[pos] = 'E'; continue; }   // always has a real default
    if (key === 'c' || key === 'roo') { slots[pos] = 'C'; continue; }
    // Rule 3, mechanically: present in openisd.yml ⇒ E (the human stated it, even if the
    // field is one WinISD would normally compute). Absent but calculable ⇒ C. Absent and
    // not calculable ⇒ N, and the line carries the sample-exemplified default.
    // The mark follows presence/calculability ONLY — never the magnitude of the result, or
    // a field calculated to a legitimate 0 would be marked N while its line shows a value.
    if (enteredKeys.has(key)) slots[pos] = 'E';
    else if (typeof computed[key] === 'number' && isFinite(computed[key])) slots[pos] = 'C';
  }
  return slots.join('');
}
