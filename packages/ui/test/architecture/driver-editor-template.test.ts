/**
 * DriverEditorModal.vue template — every numeric field must display its SI value in the unit it is labelled
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
 * Oracle: `UNIT_GROUPS` in units.ts (the app's own SI→display factors) and `uiFields`,
 * never the component under test.
 */

import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import type {NumSpecField} from '../../src/logic/appState.js';
import type {Calculated, Entered, Readable} from '@openisd/design';
import {CellClass, cellClassOf} from '../../src/logic/useDriverCells.js';
import {OpenISDDriver, VoiceCoilWiring} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import {DateField, EnumField, Field, NumberField, TextField, ToggleField} from '@openisd/design/fields';
import {UNIT_GROUPS, unitFor, type UnitGroup} from '@openisd/design/fields';
const unitDef = (group: UnitGroup, token: string) => unitFor(group, token);

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
  /** `:precision` as bound; absent, NumInput's default — the bound `:field`'s registry
   *  precision, or 2 with no field. */
  precision: number;
  /** The `<span class="u">` unit label, or '' when the field carries none. */
  unit: string;
  /** The literal `:precision="…"` expression, for asserting it reads the registry. Absent on a
   *  NumInput bound to a `:field`, it is `<Class>.<MEMBER>.precision` of that field — the default
   *  NumInput reads. */
  precisionExpr: string;
  /** True when the field binds `group`/`field`/`base` (a click-to-rotate <UnitToggle>) rather
   *  than a fixed `:scale` + static `<span class="u">` label. */
  toggleable: boolean;
  /** The registry member the NumInput binds as `:field` (the one it takes min/max from), or
   *  null when the cell binds no such attribute. */
  regField: Field | null;
}

/** The registry member a template names, e.g. `NumberField.DD_M`. */
function memberNamed(cls: string, name: string): Field {
  const classes: Record<string, object> = {NumberField, EnumField, TextField, ToggleField, DateField};
  const holder = classes[cls];
  assert.ok(holder, `the template names ${cls}, which this test does not know`);
  const found = Object.entries(holder).find((entry): entry is [string, Field] => entry[0] === name && entry[1] instanceof Field);
  assert.ok(found, `${cls}.${name} is not a registry member`);
  return found[1];
}

/** Evaluate a template numeric expression: a literal, or `<Class>.<MEMBER>.precision`. */
function evalNum(expr: string, fallback: number): number {
  if (expr === '') return fallback;
  const reg = /^(\w+Field)\.([A-Z0-9_]+)\.precision$/.exec(expr);
  if (reg) {
    const member = memberNamed(reg[1], reg[2]);
    assert.ok(member instanceof NumberField, `${reg[1]}.${reg[2]} is not a NumberField`);
    return member.precision;
  }
  const n = Number(expr);
  assert.ok(Number.isFinite(n), `unparseable numeric binding: ${expr}`);
  return n;
}

const RESISTANCE_FIELDS = [
  NumberField.RMS_KG_PER_S, NumberField.RME_KG_PER_S, NumberField.MCOST_KG_PER_S,
] as const;

/** Every `.de-fld` block in the editor template that binds a NumInput to a driver cell. */
function boundFields(): Bound[] {
  const out: Bound[] = [];
  // Split on the field wrapper; each chunk runs to the start of the next field.
  for (const chunk of src.split('<div class="de-fld"').slice(1)) {
    const binding = /<label>\{\{ (\w+Field)\.([A-Z0-9_]+)\.label \}\}<\/label>/.exec(chunk);
    const label = binding ? memberNamed(binding[1], binding[2]).label
      : /<label>([^<]*)<\/label>/.exec(chunk)?.[1]?.trim();
    const field = /<NumInput[^>]*:model-value="cellVal\('([^']+)'\)"/.exec(chunk)?.[1];
    if (!label || !field) continue;                       // read-only readout or a text input
    const numInput = /<NumInput[\s\S]*?>/.exec(chunk)![0];
    const regMatch = /:field="(\w+Field)\.([A-Z0-9_]+)"/.exec(numInput);
    const regField = regMatch ? memberNamed(regMatch[1], regMatch[2]) : null;
    const precisionExpr = /:precision="([^"]+)"/.exec(numInput)?.[1]
      ?? (regMatch ? `${regMatch[1]}.${regMatch[2]}.precision` : '');

    // A field with a click-to-rotate unit is SWITCHABLE on its own registry entry — the template
    // carries only `:field=`, never a separate `group=`/`base=` (BUG_20260928, "NumInput's
    // group/base props are a fourth table"; the field states its display once, as
    // `NumberField.display`). Its unit label lives inside UnitToggle.vue's own template, not
    // literally in this file's source, so `unitDef()` — the same resolver NumInput/UnitToggle use
    // at runtime — is asked for the field's BASE token, giving the exact label/factor a fresh
    // render shows.
    if (regField instanceof NumberField && regField.display.kind === 'switchable') {
      const {group, base} = regField.display;
      const def = unitDef(group, base);
      const scale = def.kind === 'switchable' ? def.factor : 1;
      out.push({ label, field, scale, precision: evalNum(precisionExpr, 2), unit: def.label, precisionExpr, toggleable: true, regField });
      continue;
    }

    const scaleExpr = /:scale="([^"]+)"/.exec(numInput)?.[1] ?? '';
    out.push({
      label,
      field,
      scale: evalNum(scaleExpr, 1),
      precision: evalNum(precisionExpr, 2),
      // A fixed-unit field's label is the registry symbol, drawn by UnitToggle (no literal here).
      unit: regField instanceof NumberField && /<UnitToggle[^>]*:field=/.test(chunk) ? regField.unitLabel()
        : /<span class="u">([^<]*)<\/span>/.exec(chunk)?.[1]?.trim() ?? '',
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

/** The driver's accessor for a runtime field name, via `logic/driverSpecFields.ts` — the ONE
 *  dispatch table (`SpecField` never appears as a public parameter on `OpenISDDriver` itself,
 *  human ruling 2026-08-24, ENCAPSULATION_AND_LAYERING.md). A second copy here would be a second
 *  table free to disagree with the one the editor actually uses.
 *
 *  Typed over `NumSpecField`, same as the editor's own numeric table — total, no fallback. */
function driverCellOf(d: OpenISDDriver, field: NumSpecField): Readable<number | null> & Entered & Calculated {
  return d.specField(field);
}

/** A field name scraped off the template (`Bound.field`) really is a numeric spec cell — every
 *  key `d.specs` answers except the wiring dropdown `VCCon`, which has no numeric cell. */
function isNumSpecField(field: string, d: OpenISDDriver): field is NumSpecField {
  return field !== 'VCCon' && field in d.specs;
}

const _engine = createEngine();
/** A driver stating nothing — the domain's own blank, not a record assembled here. These tests
 *  are about which cells the editor binds, not about any driver's contents. */
function blankDriver(): OpenISDDriver {
  return OpenISDDriver.empty(_engine);
}

/** A driver with every core T/S parameter present, in SI. */
function coreDriver(): OpenISDDriver {
  const d = blankDriver();
  d.specs.Fs_hz.set(37);
  d.specs.Qes.set(0.4);
  d.specs.Qms.set(7.0);
  d.specs.Vas_m3.set(0.03);
  d.specs.Sd_m2.set(0.0133);
  d.specs.Re_ohm.set(5.6);
  d.specs.Xmax_m.set(0.005);
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
    // shows it in kHz (docs/images/winisd/edit-driver-page2-parameters.png). 1234 Hz ⇒ 1.234 kHz.
    const f = byLabel('fLe');
    assert.equal(f.unit, 'kHz');
    assert.equal(1234 * f.scale, 1.234);
  });

  it('AlfaVC stores per-kelvin when the human types under the "1000/K" label', () => {
    // The label is WinISD's: its Advanced parameters tab prints "1000/K" beside AlfaVC
    // (docs/images/winisd/edit-driver-page3-advanced-parameters.png). The stored quantity is SI 1/K —
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
    for (const label of ['Basket Plate Thickness (Thick)', 'Driver Depth (Depth)', 'Magnet Depth',
                         'Magnet Diameter (Magnet)', 'Basket Diameter (Basket)',
                         'Outer Diameter (Outer)', 'Voice Coil Dia (Vcd)']) {
      const f = byLabel(label);
      assert.equal(f.unit, 'mm', `${label} is labelled "${f.unit}"`);
      assert.equal(0.165 * f.scale, 165, `${label} renders 0.165 m as ${0.165 * f.scale} ${f.unit}`);
    }
  });
});

describe('resistance unit group — Ns/m ↔ kg/s, factor 1 (ledger QO51)', () => {
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

  // Binding `field="Rms"`/`"Rme"`/`"Mcost"` (needed for the toggle) also wires NumInput's
  // `regSpec` (NumInput.vue), so `effMax` switches from unbounded to the registry's ceiling —
  // a real behaviour change, not just a label. Pinned here by replicating NumInput's own
  // `valid(si)` in SI space, the same registry/`byLabel` seam every other test in this file uses.
  function withinRegistryBounds(f: NumberField, si: number): boolean {
    return isFinite(si) && si >= f.limits.min && si <= f.limits.max;
  }

  it('Rms/Rme/Mcost wire the registry ceiling into the bound check', () => {
    for (const spec of RESISTANCE_FIELDS) {
      const f = byLabel(spec.label);
      assert.equal(f.regField, spec,
        `${spec.value}'s NumInput does not bind it — its min/max never reach this cell's bound check`);
      assert.equal(spec.limits.max, 1000, `${spec.value}'s ceiling is no longer 1000 — update this pin`);
      assert.equal(withinRegistryBounds(spec, 1000), true,
        `${spec.value}: exactly at the registry ceiling must still be a valid value`);
      assert.equal(withinRegistryBounds(spec, 1000.0001), false,
        `${spec.value}: binding the field switches the bound check onto max=1000 — 1000.0001 must be rejected`);
    }
  });
});

describe('percent unit group — one unit, the ONE place a fraction becomes a percentage', () => {
  it('no and Gloss render through the group, not a hand-bound :scale', () => {
    for (const label of ['η₀', 'Gloss']) {
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

});

describe('driver editor — precision comes from the field registry', () => {
  // The registry is the SSOT for what a field shows. A hardcoded
  // dp at the call site is a second, silent declaration: Dd at 2 dp of a metre is ±5 mm on a
  // cone diameter, and nothing connects that number back to the field's spec.
  const REGISTRY_FIELD: ReadonlyMap<string, NumberField> = new Map([
    ['Dd', NumberField.DD_M],
    ['fLe', NumberField.FLE_HZ],
    // Mechanical fields carry "Full Name (Short)" labels, taken from WinISD's own help
    // (docs/winisd_helpfiles/help/thielesmall.html). Keys here are the rendered label text.
    ['Basket Plate Thickness (Thick)', NumberField.THICK_M],
    ['Driver Depth (Depth)', NumberField.DEPTH_M],
    ['Magnet Depth', NumberField.MAGDEPTH_M],
    ['Magnet Diameter (Magnet)', NumberField.MAGNET_M],
    ['Basket Diameter (Basket)', NumberField.BASKET_M],
    ['Outer Diameter (Outer)', NumberField.OUTER_M],
    ['Voice Coil Dia (Vcd)', NumberField.VCD_M],
    ['Driver Displacement Volume (DVol)', NumberField.DVOL_M3],
  ]);

  for (const [label, spec] of REGISTRY_FIELD) {
    const member = [...Object.entries(NumberField)].find(([, v]) => v === spec)![0];
    it(`${label} reads its precision off ${member} and renders that field's declared unit`, () => {
      const f = byLabel(label);
      assert.equal(
        f.precisionExpr,
        `NumberField.${member}.precision`,
        `${label} hardcodes :precision="${f.precisionExpr || '(absent — NumInput default 2)'}" instead of reading the registry`,
      );
      const registryUnit = spec.display.kind === 'fixed' ? spec.display.symbol
        : unitDef(spec.display.group, spec.display.base).label;
      assert.equal(registryUnit, f.unit,
        `the registry says ${spec.value} is in "${registryUnit}"; the editor labels it "${f.unit}"`);
    });
  }

  it('Dd resolves finer than a millimetre', () => {
    // 0.13 m at 2 dp of a metre is ±5 mm of a cone diameter — coarser than the datasheet.
    const f = byLabel('Dd');
    const shown = (0.109980797 * f.scale).toFixed(Math.max(2, f.precision));
    assert.equal(shown, '109.98', `Dd renders 0.109980797 m as "${shown} ${f.unit}"`);
  });
});

describe('driver editor — peak power in the Miscellaneous parameters group', () => {
  it('power_peak_W has a registry label and a bound field row, in watts', () => {
    const f = byLabel(NumberField.POWER_PEAK_W.label);
    assert.equal(f.field, 'power_peak_W');
    assert.equal(f.unit, 'W');
  });
});

describe('driver editor — Auto calculate unknowns checkbox drives the draft, not a dead local ref', () => {
  // Static source check, same convention as the DQ-strip block below: no mount, no browser.
  it('the checkbox binds to a computed backed by draft.autoCalculate/setAutoCalculate', () => {
    assert.match(src, /const autoCalculate = computed\(\{/,
      'autoCalculate is not a computed — still a plain ref(true) that drives nothing');
    assert.match(src, /get:\s*\(\)\s*=>\s*\{[^}]*return draft\.autoCalculate;\s*\}/,
      'autoCalculate computed does not read draft.autoCalculate');
    assert.match(src, /set:\s*\(v: boolean\)\s*=>\s*\{\s*draft\.setAutoCalculate\(v\);/,
      'autoCalculate computed does not write through draft.setAutoCalculate');
  });

  it('no leftover FIXME claims the checkbox is inert', () => {
    assert.doesNotMatch(src, /BUG_20260908_driver_editor_autocalculate_checkbox_controls_nothing/,
      'stale FIXME still references the closed bug');
  });

  it('the template still wires the checkbox to autoCalculate', () => {
    assert.match(src, /<input type="checkbox" v-model="autoCalculate" \/>/);
  });
});

describe('driver editor — DQ strips are a scrollable bullet list with the subject highlighted', () => {
  // Static source checks, same convention as `boundFields()` above: no mount, no browser.
  const stripBlocks = src.match(/<div v-if="\w+Reasons\.length"[\s\S]*?<\/div>\n/g) ?? [];

  it('finds all three DQ strips (identity, chart-blocking, inconsistent-input)', () => {
    assert.equal(stripBlocks.length, 3, 'expected exactly the identity/chartBlocking/inconsistentInput strips');
  });

  it('each strip renders its reasons as a <ul><li> list, not a joined string', () => {
    for (const block of stripBlocks) {
      assert.match(block, /<ul class="de-incomplete-list">/, `strip does not render a <ul>: ${block}`);
      assert.match(block, /<li v-for="r in \w+" :key="r\.subject \+ r\.text">/, `strip's <li> is not keyed on the typed {subject, text} shape: ${block}`);
    }
  });

  it('each <li> highlights the subject in its own element, not inline text', () => {
    for (const block of stripBlocks) {
      assert.match(block, /<strong class="de-incomplete-subject">\{\{ r\.subject \}\}<\/strong> \{\{ r\.text \}\}/,
        `strip's <li> does not highlight r.subject separately from r.text: ${block}`);
    }
  });

  it('no strip still joins reasons into one string with a middot', () => {
    assert.doesNotMatch(src, /\.join\(' · '\)/, 'a DQ strip still joins reasons into a single string instead of a bullet list');
  });

  it('the list is capped at 5 lines and scrolls beyond that', () => {
    const css = /\.de-incomplete-list\s*\{([^}]*)\}/.exec(src);
    assert.ok(css, 'no .de-incomplete-list rule in the stylesheet');
    assert.match(css![1], /overflow-y:\s*auto/, '.de-incomplete-list does not scroll');
    const maxHeight = /max-height:\s*([\d.]+)em/.exec(css![1]);
    assert.ok(maxHeight, '.de-incomplete-list has no max-height cap in em');
    const lineHeightMatch = /\.de-incomplete\s*\{[^}]*line-height:\s*([\d.]+)/.exec(src);
    assert.ok(lineHeightMatch, 'no line-height on .de-incomplete to compute the 5-line cap against');
    const lines = Number(maxHeight![1]) / Number(lineHeightMatch![1]);
    assert.ok(lines >= 4.9 && lines <= 5.1, `max-height ${maxHeight![1]}em at line-height ${lineHeightMatch![1]} caps at ${lines} lines, not 5`);
  });
});

describe('driver editor — every bound cell is one the driver model answers', () => {
  it('SPL and no read cells the ADT derives from Fs/Vas/Qes', () => {
    const d = coreDriver();
    for (const label of ['SPL', 'η₀']) {
      const f = byLabel(label);
      if (!isNumSpecField(f.field, d)) assert.fail(`${label} binds cellVal('${f.field}'), not a numeric spec field`);
      const cell = driverCellOf(d, f.field);
      assert.equal(
        typeof cell.value,
        'number',
        `${label} binds cellVal('${f.field}'), which the driver model leaves ${cell.provenance} — the field renders blank`,
      );
    }
  });

  it('Voicecoils reads WinISD\'s default of 1, marked calculated so it is not mistaken for entered', () => {
    // John, 2026-09-08: "use the existing WinIsd default values - but some of these are
    // functions like calcVcCon() ... which isn't really a calc but plays that role if the VCCon
    // isn't yet stated". WinISD's own blank-driver screen
    // (docs/images/winisd/edit-driver-page2-parameters.png) shows 1 there, and `calculated`
    // is exactly how the panel distinguishes that from a number the user typed.
    const f = byLabel('Voicecoils');
    const d = coreDriver();
    if (!isNumSpecField(f.field, d)) assert.fail(`Voicecoils binds cellVal('${f.field}'), not a numeric spec field`);
    const cell = driverCellOf(d, f.field);
    assert.equal(cell.calculated, true, `Voicecoils cell is ${cell.provenance} — an unstated coil count reads as the default, derived`);
    assert.equal(cell.value, 1, 'and the default is WinISD\'s 1');
    assert.equal(d.specs.numVC.value ?? 1, 1, 'the ENGINE-facing driver must still default numVC to 1 for simulation');
  });

  it('the Connection control carries a provenance mark, like every cell beside it', () => {
    // BUG_20260924_defaulted-fields-are-neither-marked-nor-recorded: the wiring select was the
    // one control in the dialog with no mark, so a Parallel nobody stated looked exactly like a
    // Parallel the user picked. VCCon is entry-backed now — a resolve stores the default as 'C'
    // — so there is a real provenance for the control to show.
    const sel = /<select class="de-conn-sel"[^>]*>/.exec(src);
    assert.ok(sel, 'no wiring <select> in the editor');
    assert.match(sel![0], /:class="wiringClass"/, 'the wiring select binds no provenance class');

    const blank = blankDriver();
    assert.equal(cellClassOf(blank.specs.VCCon), CellClass.Calculated,
      'an unstated wiring does not read as calculated');
    const chosen = blankDriver();
    chosen.specs.VCCon.set(VoiceCoilWiring.Series);
    assert.equal(cellClassOf(chosen.specs.VCCon), CellClass.Entered,
      'a wiring the user picked does not read as entered');
  });
});
