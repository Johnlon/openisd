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
import { Driver } from '@openisd/winisd';
import { precision, fieldById } from '../../src/logic/fields/fieldRegistry.js';
import { UNIT_GROUPS } from '../../src/logic/fields/units.js';

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
    const scaleExpr = /:scale="([^"]+)"/.exec(numInput)?.[1] ?? '';
    const precisionExpr = /:precision="([^"]+)"/.exec(numInput)?.[1] ?? '';
    out.push({
      label,
      field,
      scale: evalNum(scaleExpr, 1),
      precision: evalNum(precisionExpr, 2),
      unit: /<span class="u">([^<]*)<\/span>/.exec(chunk)?.[1]?.trim() ?? '',
      precisionExpr,
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

/** A driver with every core T/S parameter present, in SI. */
function coreDriver(): Driver {
  const d = new Driver();
  d.enter('Fs', 37);
  d.enter('Qes', 0.4);
  d.enter('Qms', 7.0);
  d.enter('Vas', 0.03);
  d.enter('Sd', 0.0133);
  d.enter('Re', 5.6);
  d.enter('Xmax', 0.005);
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
    // .wdr stores fLe in Hz (docs/design/WDR_SCHEMA.md, fLe row); WinISD's Parameters tab
    // shows it in kHz (docs/winisd/edit_driver_pg2_parameters.png). 1234 Hz ⇒ 1.234 kHz.
    const f = byLabel('fLe');
    assert.equal(f.unit, 'kHz');
    assert.equal(1234 * f.scale, 1.234);
  });

  it('AlfaVC stores per-kelvin when the human types under the "1000/K" label', () => {
    // The label is WinISD's: its Advanced parameters tab prints "1000/K" beside AlfaVC
    // (docs/winisd/edit_driver_pg3_advanced_parameters.png). The stored quantity is SI 1/K —
    // docs/design/WDR_SCHEMA.md's alfaVC row ("1/K … copper ≈ 0.0039"), and a real WinISD
    // project holds exactly that for a copper coil (docs/winisd/sample_project_Epique15_-_pr.wpr
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
    for (const label of ['Thick', 'Depth', 'Magnet Depth', 'Magnet', 'Basket', 'Outer', 'VCd']) {
      const f = byLabel(label);
      assert.equal(f.unit, 'mm', `${label} is labelled "${f.unit}"`);
      assert.equal(0.165 * f.scale, 165, `${label} renders 0.165 m as ${0.165 * f.scale} ${f.unit}`);
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
    const text = readFileSync(join(here, '..', '..', '..', '..', 'drivers', 'sample', 'winisd', 'john-all-noncalc-fields-manually-entered.wdr'), 'utf8');
    const stored = /^Gloss=(.*)$/m.exec(text)?.[1];
    assert.equal(stored, '1.72503712771898', 'fixture must be the WinISD-authored oracle');
    assert.equal(Driver.fromWdr(text).cell('loss').value, 1.72503712771898,
      'the parser must not scale — the model holds the file\'s fraction as written');
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
    const cell = d.cell('loss');
    assert.equal(typeof cell.value, 'number',
      `Gloss binds cellVal('loss'), which the driver model leaves ${cell.state} — the field renders blank`);
    // g/((2π·37)²·0.005) for coreDriver's Fs/Xmax.
    assert.ok(Math.abs((cell.value as number) - 9.80665 / ((2 * Math.PI * 37) ** 2 * 0.005)) < 1e-15);
  });
});

describe('driver editor — precision comes from the field registry', () => {
  // The registry is the SSOT for what a field shows (fieldRegistry.ts header). A hardcoded
  // dp at the call site is a second, silent declaration: Dd at 2 dp of a metre is ±5 mm on a
  // cone diameter, and nothing connects that number back to the field's spec.
  const REGISTRY_ID: Record<string, string> = {
    Dd: 'Dd',
    fLe: 'fLe',
    Thick: 'dimThick',
    Depth: 'dimDepth',
    'Magnet Depth': 'dimMagnetDepth',
    Magnet: 'dimMagnet',
    Basket: 'dimBasket',
    Outer: 'dimOuter',
    VCd: 'dimVCd',
    Dvol: 'dimDvol',
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
      const cell = d.cell(f.field);
      assert.equal(
        typeof cell.value,
        'number',
        `${label} binds cellVal('${f.field}'), which the driver model leaves ${cell.state} — the field renders blank`,
      );
    }
  });

  it('Voicecoils reads 1 on a driver that never specified a coil count', () => {
    // WinISD shows 1 there on a blank driver (docs/winisd/edit_driver_pg2_parameters.png),
    // and Driver.fromWdr already backfills numVC=1 for a .wdr that omits the key — so a
    // driver built any other way must answer the same, not blank.
    const f = byLabel('Voicecoils');
    const cell = coreDriver().cell(f.field);
    assert.equal(cell.value, 1, `Voicecoils is ${cell.state} (${String(cell.value)}) instead of the default 1`);
  });
});
