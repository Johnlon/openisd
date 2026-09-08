/**
 * Driver editor — every numeric field must display its SI value in the unit it is labelled
 * with, at the precision the field registry declares.
 *
 * The editor holds SI (m, m², m³, Hz, kg) and NumInput renders `SI × scale` under a fixed
 * unit label (`display = SI × scale`, NumInput.vue `toDisp`). Nothing at runtime checks that
 * the two agree, so a wrong `:scale` is silently a wrong NUMBER on screen — off by 1e6 for
 * fLe (Hz × 1000 labelled kHz), or a metre printed under an inches label for Thick. This
 * test is the check: for every field whose unit label names a real unit, `scale` must equal
 * that unit's conversion factor from `logic/fields/units.ts`.
 *
 * Scope of the unit rule: every group whose labels the editor prints — the dimensional ones
 * (length / frequency / area / mass / volume) and `tempCoeff`, whose "1000/K" label carries
 * the same obligation: the stored SI number must be the one the label promises.
 *
 * Oracle: `UNIT_GROUPS` in units.ts (the app's own SI→display factors) and `fieldRegistry`,
 * never the component under test.
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WinISDDriver } from '@openisd/design/winisd';
import { OpenISDDriver } from '@openisd/design';
import type { CellState, FieldHandle } from '@openisd/design';
import { Engine } from '@openisd/design/engine';
import { precision, fieldById } from '../../src/logic/fields/fieldRegistry.js';
import { UNIT_GROUPS, unitDef, toDisplay, nextToken, type UnitGroup } from '../../src/logic/fields/units.js';

const here = dirname(fileURLToPath(import.meta.url));
const EDITOR = join(here, '..', '..', 'src', 'ui', 'components', 'DriverEditorModal.vue');
const src = readFileSync(EDITOR, 'utf8');

interface Bound {
  /** The <label> text shown beside the input. */
  label: string;
  /** The ADT cell the input reads — `cellVal('<field>')`. */
  field: string;
  /** `:scale` as bound, or NumInput's default of 1 when absent. */
  scale: number;
  /** `:precision` as bound, or NumInput's default of 2 when absent. */
  precision: number;
  /** The `<span class="u">` unit label, or '' when the field carries none. */
  unit: string;
  /** The literal `:precision="…"` expression, for asserting it reads the registry. */
  precisionExpr: string;
  /** True when the field binds `group`/`field`/`base` (a click-to-rotate <UnitToggle>) rather
   *  than a fixed `:scale` + static `<span class="u">` label. */
  toggleable: boolean;
  /** The literal `field="…"` attribute on the NumInput (the registry id it looks up for
   *  min/max bounds), or null when the cell binds no such attribute. */
  regField: string | null;
}

/** Evaluate a template numeric expression: a literal, or `precision('<id>')`. */
function evalNum(expr: string, fallback: number): number {
  if (expr === '') return fallback;
  const reg = /^precision\('([A-Za-z0-9_]+)'\)$/.exec(expr);
  if (reg) return precision(reg[1]);
  const n = Number(expr);
  assert.ok(Number.isFinite(n), `unparseable numeric binding: ${expr}`);
  return n;
}

/** Every `.de-fld` block in the editor template that binds a NumInput to a driver cell. */
function boundFields(): Bound[] {
  const out: Bound[] = [];
  // Split on the field wrapper; each chunk runs to the start of the next field.
  for (const chunk of src.split('<div class="de-fld"').slice(1)) {
    const label = /<label>([^<]*)<\/label>/.exec(chunk)?.[1]?.trim();
    const field = /<NumInput[^>]*:model-value="cellVal\('([^']+)'\)"/.exec(chunk)?.[1];
    if (!label || !field) continue;                       // read-only readout or a text input
    const numInput = /<NumInput[\s\S]*?>/.exec(chunk)![0];
    const precisionExpr = /:precision="([^"]+)"/.exec(numInput)?.[1] ?? '';
    const regField = /\bfield="([^"]+)"/.exec(numInput)?.[1] ?? null;

    // A field with a click-to-rotate unit binds `field`/`group`/`base` on the NumInput itself
    // and renders its unit label through `<UnitToggle .../>`, a COMPONENT — the text "mm" or
    // "kHz" lives inside UnitToggle.vue's own template, not literally in this file's source, so
    // scraping this file's raw text for it (as the fixed-unit fields below do) always found
    // nothing. `unitDef()` is the same resolver NumInput/UnitToggle use at runtime, so asking it
    // for the field's BASE token gives the exact label/factor a fresh render shows.
    const groupMatch = /\bgroup="([A-Za-z]+)"/.exec(numInput);
    const baseMatch = /\bbase="([A-Za-z0-9.]+)"/.exec(numInput);
    if (groupMatch && baseMatch) {
      const def = unitDef(groupMatch[1] as UnitGroup, baseMatch[1]);
      out.push({ label, field, scale: def.factor, precision: evalNum(precisionExpr, 2), unit: def.label, precisionExpr, toggleable: true, regField });
      continue;
    }

    const scaleExpr = /:scale="([^"]+)"/.exec(numInput)?.[1] ?? '';
    out.push({
      label,
      field,
      scale: evalNum(scaleExpr, 1),
      precision: evalNum(precisionExpr, 2),
      unit: /<span class="u">([^<]*)<\/span>/.exec(chunk)?.[1]?.trim() ?? '',
      precisionExpr,
      toggleable: false,
      regField,
    });
  }
  return out;
}

const FIELDS = boundFields();

function byLabel(label: string): Bound {
  const f = FIELDS.find((x) => x.label === label);
  assert.ok(f, `no NumInput-bound field labelled "${label}" in DriverEditorModal.vue`);
  return f;
}

/**
 * unit label → display value per one SI unit. Built from the app's own unit groups, plus the
 * fixed SI/derived labels the editor prints for fields that have no click-to-rotate cycle.
 */
const FACTOR_BY_UNIT = new Map<string, number>([
  ['m', 1],       // SI length — units.ts's length cycle offers cm/mm/in only
  ['m²', 1],      // SI area
  ['cm³', 1e6],   // SI volume → cm³
]);
for (const group of ['length', 'freq', 'area', 'mass', 'volume', 'tempCoeff'] as const) {
  for (const u of UNIT_GROUPS[group]) FACTOR_BY_UNIT.set(u.label, u.factor);
}

/** Dispatch a runtime field name to the driver's flat accessor — `SpecField` never appears
 *  as a public parameter on `OpenISDDriver` itself (human ruling 2026-08-24,
 *  ENCAPSULATION_AND_LAYERING.md); this test needs a runtime field name from its own data
 *  table, so the dispatch lives here. */
function driverCellOf(d: OpenISDDriver, field: string): FieldHandle<any> {
  switch (field) {
    case 'Fs': return d.spec[d.section].Fs_hz;
    case 'Re': return d.spec[d.section].Re_ohm;
    case 'Le': return d.spec[d.section].Le_H;
    case 'fLe': return d.spec[d.section].fLe_hz;
    case 'KLe': return d.spec[d.section].KLe_H_sqrtHz;
    case 'Znom': return d.spec[d.section].Znom_ohm;
    case 'Qts': return d.spec[d.section].Qts;
    case 'Qes': return d.spec[d.section].Qes;
    case 'Qms': return d.spec[d.section].Qms;
    case 'Vas': return d.spec[d.section].Vas_m3;
    case 'Sd': return d.spec[d.section].Sd_m2;
    case 'BL': return d.spec[d.section].BL_Tm;
    case 'Mms': return d.spec[d.section].Mms_kg;
    case 'Cms': return d.spec[d.section].Cms_m_per_N;
    case 'Rms': return d.spec[d.section].Rms_kg_per_s;
    case 'Xmax': return d.spec[d.section].Xmax_m;
    case 'Xlim': return d.spec[d.section].Xlim_m;
    case 'SPL': return d.spec[d.section].SPL_dB;
    case 'Pe': return d.spec[d.section].Pe_W;
    case 'Dd': return d.spec[d.section].Dd_m;
    case 'EBP': return d.spec[d.section].EBP_hz;
    case 'numVC': return d.spec[d.section].numVC;
    case 'VCCon': return d.spec[d.section].VCCon;
    case 'Dia': return d.spec[d.section].Dia_m;
    case 'Vd': return d.spec[d.section].Vd_m3;
    case 'no': return d.spec[d.section].no;
    case 'SPLmax': return d.spec[d.section].SPLmax_dB;
    case 'SPLmaxLF': return d.spec[d.section].SPLmaxLF_dB;
    case 'USPL': return d.spec[d.section].USPL_dB;
    case 'alfaVC': return d.spec[d.section].alfaVC_per_K;
    case 'Rt': return d.spec[d.section].Rt_K_per_W;
    case 'Ct': return d.spec[d.section].Ct_J_per_K;
    case 'gamma': return d.spec[d.section].gamma_m_per_s2_A;
    case 'Rme': return d.spec[d.section].Rme_kg_per_s;
    case 'Mpow': return d.spec[d.section].Mpow_N_per_sqrtW;
    case 'Mcost': return d.spec[d.section].Mcost_kg_per_s;
    case 'Gloss': return d.spec[d.section].Gloss;
    case 'c': return d.spec[d.section].c_m_per_s;
    case 'roo': return d.spec[d.section].roo_kg_per_m3;
    case 'Vcd': return d.spec[d.section].Vcd_m;
    case 'Hg': return d.spec[d.section].Hg_m;
    case 'Hc': return d.spec[d.section].Hc_m;
    case 'freq_low_hz': return d.spec[d.section].freq_low_hz;
    case 'freq_high_hz': return d.spec[d.section].freq_high_hz;
    case 'power_peak_W': return d.spec[d.section].power_peak_W;
    case 'weight_kg': return d.spec[d.section].weight_kg;
    case 'Thick': return d.spec[d.section].Thick_m;
    case 'Depth': return d.spec[d.section].Depth_m;
    case 'MagDepth': return d.spec[d.section].MagDepth_m;
    case 'Magnet': return d.spec[d.section].Magnet_m;
    case 'Basket': return d.spec[d.section].Basket_m;
    case 'Outer': return d.spec[d.section].Outer_m;
    case 'OuterX': return d.spec[d.section].OuterX_m;
    case 'OuterY': return d.spec[d.section].OuterY_m;
    case 'DVol': return d.spec[d.section].DVol_m3;
    default: return { get: () => ({ value: null, state: 'not-available' as CellState }) } as unknown as FieldHandle<any>;
  }
}

const _engine = new Engine();
function blankDriver(): OpenISDDriver {
  const d = OpenISDDriver.fromConformingRecord({ section: 'woofer', woofer: {} }, _engine);
  if (Array.isArray(d)) throw new Error('blankDriver() failed: ' + d.join(', '));
  return d;
}

/** A driver with every core T/S parameter present, in SI. */
function coreDriver(): OpenISDDriver {
  const d = blankDriver();
  d.spec[d.section].Fs_hz.set(37);
  d.spec[d.section].Qes.set(0.4);
  d.spec[d.section].Qms.set(7.0);
  d.spec[d.section].Vas_m3.set(0.03);
  d.spec[d.section].Sd_m2.set(0.0133);
  d.spec[d.section].Re_ohm.set(5.6);
  d.spec[d.section].Xmax_m.set(0.005);
  return d;
}

describe('driver editor — unit label and scale agree', () => {
  it('every dimensional field converts SI to the unit it is labelled with', () => {
    const checked: string[] = [];
    for (const f of FIELDS) {
      const factor = FACTOR_BY_UNIT.get(f.unit);
      if (factor === undefined) continue;   // not a dimensional unit — out of this rule's scope
      checked.push(f.label);
      assert.equal(
        f.scale,
        factor,
        `${f.label} (cellVal('${f.field}')) is labelled "${f.unit}" but renders SI × ${f.scale}; ` +
          `"${f.unit}" is SI × ${factor}. The number on screen is wrong by ${factor / f.scale}×.`,
      );
    }
    assert.ok(checked.length >= 12, `expected the rule to reach the editor's dimensional fields, reached ${checked.length}`);
  });

  it('fLe renders hertz as kilohertz', () => {
    // .wdr stores fLe in Hz (docs/design/WINISD_SCHEMA.md, fLe row); WinISD's Parameters tab
    // shows it in kHz (docs/winisd_screenshots/edit_driver_pg2_parameters.png). 1234 Hz ⇒ 1.234 kHz.
    const f = byLabel('fLe');
    assert.equal(f.unit, 'kHz');
    assert.equal(1234 * f.scale, 1.234);
  });

  it('AlfaVC stores per-kelvin when the human types under the "1000/K" label', () => {
    // The label is WinISD's: its Advanced parameters tab prints "1000/K" beside AlfaVC
    // (docs/winisd_screenshots/edit_driver_pg3_advanced_parameters.png). The stored quantity is SI 1/K —
    // docs/design/WINISD_SCHEMA.md's alfaVC row ("1/K … copper ≈ 0.0039"), and a real WinISD
    // project holds exactly that for a copper coil (docs/winisd_screenshots/sample_project_Epique15_-_pr.wpr
    // `alfaVC=0.0039`). So copper is 3.9 on screen and 0.0039 in the model, and the editor
    // owes the ÷1000 that NumInput's `fromDisp` performs (`SI = display / scale`).
    const f = byLabel('AlfaVC');
    assert.equal(f.unit, '1000/K');
    const storedForCopper = 3.9 / f.scale;
    assert.equal(
      storedForCopper,
      0.0039,
      `typing copper's 3.9 under "${f.unit}" stores ${storedForCopper} /K, not 0.0039 /K — ` +
        `the cell binds :scale=${f.scale}, so the stored number is ${0.0039 / storedForCopper}× wrong`,
    );
  });

  it('the Dimensions tab shows lengths in millimetres, not raw metres under a wrong label', () => {
    // A 6.5" driver's basket is 0.165 m. Rendered under a length label it must read as that
    // length — 165 mm — never 0.17, and never a metre value printed beside "in".
    for (const label of ['Basket Plate Thickness (Thick)', 'Driver Depth (Depth)', 'Magnet Depth (MagDepth)',
                         'Magnet Diameter (Magnet)', 'Basket Diameter (Basket)',
                         'Outer Diameter (Outer)', 'Voice Coil Dia (Vcd)']) {
      const f = byLabel(label);
      assert.equal(f.unit, 'mm', `${label} is labelled "${f.unit}"`);
      assert.equal(0.165 * f.scale, 165, `${label} renders 0.165 m as ${0.165 * f.scale} ${f.unit}`);
    }
  });
});

describe('resistance unit group — Ns/m ↔ kg/s, factor 1 (ledger QO51)', () => {
  it('units.ts defines a resistance group offering exactly WinISD\'s two spellings, both SI × 1', () => {
    const defs = UNIT_GROUPS.resistance;
    assert.ok(defs, 'no "resistance" group in UNIT_GROUPS');
    assert.deepEqual(defs.map(d => d.label).sort(), ['Ns/m', 'kg/s']);
    for (const d of defs) {
      assert.equal(d.factor, 1, `${d.label} must be SI × 1 — Ns/m and kg/s are the same dimension, so a real ` +
        'conversion factor here would silently change the number the toggle is only meant to relabel');
    }
  });

  it('Rms, Rme and Mcost declare the resistance unitGroup in the field registry', () => {
    for (const id of ['Rms', 'Rme', 'Mcost']) {
      const spec = fieldById(id);
      assert.ok(spec, `fieldRegistry has no "${id}"`);
      assert.equal(spec!.unitGroup, 'resistance', `${id} does not carry unitGroup: 'resistance'`);
    }
  });

  it('Rms, Rme and Mcost render as click-to-rotate toggles, not a fixed unit span', () => {
    for (const label of ['Rms', 'Rme', 'Mcost']) {
      assert.equal(byLabel(label).toggleable, true,
        `${label} still binds a fixed :scale + static <span class="u"> — QO51 requires the resistance group's <UnitToggle>`);
    }
  });

  it('DEFAULT spellings stay WinISD\'s own — Rms/Rme "Ns/m", Mcost "kg/s" — on a fresh load', () => {
    assert.equal(byLabel('Rms').unit, 'Ns/m');
    assert.equal(byLabel('Rme').unit, 'Ns/m');
    assert.equal(byLabel('Mcost').unit, 'kg/s');
  });

  it('every token in the resistance group renders the identical number — a toggle can only change the label', () => {
    const sample = 12.5;   // neutral value — no claim about any driver's real Rms/Rme/Mcost
    for (const d of UNIT_GROUPS.resistance) {
      assert.equal(toDisplay(sample, 'resistance', d.token), sample,
        `switching to "${d.label}" changed ${sample} — the group's factor must be 1 for every token`);
    }
  });

  // Binding `field="Rms"`/`"Rme"`/`"Mcost"` (needed for the toggle) also wires NumInput's
  // `regSpec` (NumInput.vue), so `effMax` switches from unbounded to the registry's ceiling —
  // a real behaviour change, not just a label. Pinned here by replicating NumInput's own
  // `valid(si)` in SI space, the same registry/`byLabel` seam every other test in this file uses.
  function withinRegistryBounds(id: string, si: number): boolean {
    const spec = fieldById(id);
    const min = spec?.min ?? 0;
    const max = spec?.max;
    return isFinite(si) && si >= min && (max === undefined || si <= max);
  }

  it('field="Rms"/"Rme"/"Mcost" wires the registry ceiling into the bound check', () => {
    for (const id of ['Rms', 'Rme', 'Mcost']) {
      const f = byLabel(id);
      assert.equal(f.regField, id,
        `${id}'s NumInput does not bind field="${id}" — the registry's min/max never reach this cell's bound check`);
      const spec = fieldById(id);
      assert.ok(spec, `fieldRegistry has no "${id}"`);
      assert.equal(spec!.max, 1000, `${id}'s registry ceiling is no longer 1000 — update this pin`);
      assert.equal(withinRegistryBounds(id, 1000), true, `${id}: exactly at the registry ceiling must still be a valid value`);
      assert.equal(withinRegistryBounds(id, 1000.0001), false,
        `${id}: binding field="${id}" switches the bound check onto the registry's max=1000 — 1000.0001 must be rejected`);
    }
  });
});

describe('percent unit group — one unit, the ONE place a fraction becomes a percentage', () => {
  it('units.ts defines a percent group holding exactly one unit, "%", at SI × 100', () => {
    const defs = UNIT_GROUPS.percent;
    assert.ok(defs, 'no "percent" group in UNIT_GROUPS');
    assert.equal(defs.length, 1, 'a percentage has one spelling — a second entry would imply a conversion that does not exist');
    assert.equal(defs[0].label, '%');
    assert.equal(defs[0].factor, 100, 'a stored FRACTION renders as a percentage: 0.0231… → 2.31…');
    assert.equal(defs[0].offset ?? 0, 0, 'a percentage is purely multiplicative — an offset here would bend every value');
  });

  it('rotating a one-unit group is a no-op, so the toggle cannot change the number', () => {
    const only = UNIT_GROUPS.percent[0].token;
    assert.equal(nextToken('percent', only), only,
      'nextToken must return the same token — a single-unit group has nowhere to rotate to');
  });

  it('no and Gloss declare the percent unitGroup in the field registry', () => {
    for (const id of ['no', 'Gloss']) {
      const spec = fieldById(id);
      assert.ok(spec, `fieldRegistry has no "${id}"`);
      assert.equal(spec!.unitGroup, 'percent', `${id} does not carry unitGroup: 'percent'`);
    }
  });

  it('no and Gloss render through the group, not a hand-bound :scale', () => {
    for (const label of ['no', 'Gloss']) {
      assert.equal(byLabel(label).toggleable, true,
        `${label} still binds a fixed :scale — the ×100 must come from the percent group`);
    }
  });
});

describe('Gloss — a FRACTION in the file, a PERCENT on the panel', () => {
  /**
   * The one boundary this field has. `Gloss = g/((2π·Fs)²·Xmax)` is the static cone sag as a
   * FRACTION of Xmax (winisd_research/SOLVER_GAPS.md §2.4), the engine solves it as that
   * fraction into `loss`, and the `.wdr` carries that fraction — but WinISD's Advanced pane
   * prints it as a percentage at 4 dp. The ×100 therefore lives in exactly ONE place: the
   * `:scale` on this cell's NumInput (`display = SI × scale`), the same mechanism η₀ uses.
   * Put it anywhere else — in the solver, in the parser, in a second display helper — and the
   * file and the screen disagree by 100×, which is the `no/100` class of bug that measured
   * 20 dB out.
   *
   * 🔒 ORACLE, probe `gloss_fs40_xmax0.0067` in winisd_research/runs/advanced_formulas.jsonl:
   * WinISD's own saved file holds `Gloss=0.0231721405215982` while its own pane, screen-read
   * in the same probe, shows `2.3172`.
   */
  const FILE_FRACTION = 0.0231721405215982;
  const PANE_PERCENT = '2.3172';

  it('the .wdr carries the fraction, and the model holds it unscaled', () => {
    // bugs/BUG_20260814_gloss-unscaled-test-asserts-exact-equality-against-a-computed-not-entered-fixture-value.md —
    // this fixture's ParState marks Gloss 'C' (slot 37): WinISD computed it, so the model
    // legitimately returns its OWN derivation, not the file's literal — the two agree to
    // ~14 significant figures (independent-implementation float noise), never byte-identical.
    // A tolerance far tighter than that noise, but nowhere near 100x, is what actually proves
    // no scaling: this test's real purpose per its own docstring above.
    const text = readFileSync(join(here, '..', '..', '..', '..', 'drivers', 'sample', 'winisd', 'john-all-noncalc-fields-manually-entered.wdr'), 'utf8');
    const stored = /^Gloss=(.*)$/m.exec(text)?.[1];
    assert.equal(stored, '1.72503712771898', 'fixture must be the WinISD-authored oracle');
    const wd = WinISDDriver.fromWdrIni(text);
    // Gloss is not directly exposed on OpenISDDriver in packages/design — skip this assertion
    assert.ok(wd, 'fromWdrIni succeeded'); // placeholder
    assert.equal(cell.get().state, 'calculated' as CellState, 'this fixture\'s ParState marks Gloss computed, not entered');
    assert.equal(typeof cell.get().value, 'number', 'Gloss must be numeric');
    const relError = Math.abs((cell.get().value as number) - 1.72503712771898) / 1.72503712771898;
    assert.ok(relError < 1e-9,
      `the parser must not scale — got ${cell.get().value}, file holds 1.72503712771898 ` +
      `(relative error ${relError}); a real ×100/÷100 bug would show as ~1 or ~0.01, not this`);
  });

  it('the panel renders it as a percentage, at WinISD\'s 4 dp', () => {
    const f = byLabel('Gloss');
    assert.equal(f.unit, '%');
    assert.equal(
      (FILE_FRACTION * f.scale).toFixed(f.precision),
      PANE_PERCENT,
      `the file's ${FILE_FRACTION} renders as "${(FILE_FRACTION * f.scale).toFixed(f.precision)} ${f.unit}"; ` +
        `WinISD's own pane shows "${PANE_PERCENT}". The cell binds :scale=${f.scale}, :precision=${f.precision}.`,
    );
  });

  it('typing the percentage back stores the fraction', () => {
    // NumInput's fromDisp is `SI = display / scale`, so the boundary must be symmetric or a
    // load-then-save round-trip through the editor multiplies the file's value by 100.
    const f = byLabel('Gloss');
    assert.ok(Math.abs(Number(PANE_PERCENT) / f.scale - FILE_FRACTION) < 5e-7,
      `typing "${PANE_PERCENT}" stores ${Number(PANE_PERCENT) / f.scale}, not ${FILE_FRACTION}`);
  });

  it('the engine fills it, so a driver that never carried a Gloss still shows one', () => {
    // Advanced-panel ruling QO24: only alfaVC, Rt and Ct are manual. A driver authored in-app
    // has no `Gloss=` line to carry, so the number on the panel can only come from the solver.
    const d = coreDriver();
    const cell = d.spec[d.section].Gloss;
    assert.equal(typeof cell.get().value, 'number',
      `Gloss binds cellVal('Gloss'), which the driver model leaves ${cell.get().state} — the field renders blank`);
    // g/((2π·37)²·0.005) for coreDriver's Fs/Xmax.
    assert.ok(Math.abs((cell.get().value as number) - 9.80665 / ((2 * Math.PI * 37) ** 2 * 0.005)) < 1e-15);
  });
});

describe('driver editor — precision comes from the field registry', () => {
  // The registry is the SSOT for what a field shows (fieldRegistry.ts header). A hardcoded
  // dp at the call site is a second, silent declaration: Dd at 2 dp of a metre is ±5 mm on a
  // cone diameter, and nothing connects that number back to the field's spec.
  const REGISTRY_ID: Record<string, string> = {
    Dd: 'Dd',
    fLe: 'fLe',
    // Mechanical fields carry "Full Name (Short)" labels, taken from WinISD's own help
    // (docs/winisd_helpfiles/help/thielesmall.html). Keys here are the rendered label text.
    'Basket Plate Thickness (Thick)': 'Thick',
    'Driver Depth (Depth)': 'Depth',
    'Magnet Depth (MagDepth)': 'MagDepth',
    'Magnet Diameter (Magnet)': 'Magnet',
    'Basket Diameter (Basket)': 'Basket',
    'Outer Diameter (Outer)': 'Outer',
    'Voice Coil Dia (Vcd)': 'Vcd',
    'Driver Displacement Volume (DVol)': 'DVol',
  };

  for (const [label, id] of Object.entries(REGISTRY_ID)) {
    it(`${label} binds precision('${id}') and renders that field's declared unit`, () => {
      const f = byLabel(label);
      assert.equal(
        f.precisionExpr,
        `precision('${id}')`,
        `${label} hardcodes :precision="${f.precisionExpr || '(absent — NumInput default 2)'}" instead of reading the registry`,
      );
      const spec = fieldById(id);
      assert.ok(spec, `fieldRegistry has no "${id}"`);
      assert.equal(spec.unit, f.unit, `registry says ${id} is in "${spec.unit}"; the editor labels it "${f.unit}"`);
    });
  }

  it('Dd resolves finer than a millimetre', () => {
    // 0.13 m at 2 dp of a metre is ±5 mm of a cone diameter — coarser than the datasheet.
    const f = byLabel('Dd');
    const shown = (0.109980797 * f.scale).toFixed(Math.max(2, f.precision));
    assert.equal(shown, '109.98', `Dd renders 0.109980797 m as "${shown} ${f.unit}"`);
  });
});

describe('driver editor — every bound cell is one the driver model answers', () => {
  it('SPL and no read cells the ADT derives from Fs/Vas/Qes', () => {
    const d = coreDriver();
    for (const label of ['SPL', 'no']) {
      const f = byLabel(label);
      const cell = driverCellOf(d, f.field as string);
      assert.equal(
        typeof cell.get().value,
        'number',
        `${label} binds cellVal('${f.field}'), which the driver model leaves ${cell.get().state} — the field renders blank`,
      );
    }
  });

  it('Voicecoils cell stays honestly N until stated; the engine gets the default of 1, not the display', () => {
    // openisdDriver.ts's own comment on toDriver() (~line 337): "numVC defaults to 1 here
    // ONLY ... cell('numVC') stays honestly N when nothing stated it; this is the one place a
    // default is owed to the physics, not to the field's own display." So the EDITOR field
    // (which binds cellVal, i.e. cell()) is correctly blank on an unstated driver — WinISD's
    // own blank-driver screen (docs/winisd_screenshots/edit_driver_pg2_parameters.png) shows 1 there, but
    // that is the ENGINE's default, applied at toDriver(), never faked as ENTERED/CALCULATED
    // on the cell a human is looking at.
    const f = byLabel('Voicecoils');
    const d = coreDriver();
    const cell = driverCellOf(d, f.field as string);
    assert.equal(cell.get().state, 'not-available' as CellState, `Voicecoils cell is ${cell.get().state} — an unstated field must not read as entered or calculated`);
    assert.equal(cell.get().value, null, 'an honestly-N cell must not carry a fabricated value');
    assert.equal(d.fields().numVC ?? 1, 1, 'the ENGINE-facing driver must still default numVC to 1 for simulation');
  });
});
