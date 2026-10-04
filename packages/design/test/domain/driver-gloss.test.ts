/**
 * Gloss — a FRACTION in the file and the model, solved by the engine.
 *
 * `Gloss = g/((2π·Fs)²·Xmax)` is the static cone sag as a FRACTION of Xmax
 * (winisd_research/SOLVER_GAPS.md §2.4); the engine solves it as that fraction and the `.wdr`
 * carries that fraction. The ×100 for the panel lives in exactly ONE place, the percent unit
 * group (see unit-groups.test.ts and ui/test/architecture/driver-editor-template.test.ts).
 *
 * ORACLE, probe `gloss_fs40_xmax0.0067` in winisd_research/runs/advanced_formulas.jsonl:
 * WinISD's own saved file holds `Gloss=0.0231721405215982` while its pane shows `2.3172`.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {WinISDDriver} from '../../winisd/index.js';
import {OpenISDDriver} from '../../domain/index.js';
import {createEngine} from '../../engine/index.js';

const here = dirname(fileURLToPath(import.meta.url));

/** A driver with every core T/S parameter present, in SI. */
function coreDriver(): OpenISDDriver {
  const d = OpenISDDriver.empty(createEngine());
  d.specs.Fs_hz.set(37);
  d.specs.Qes.set(0.4);
  d.specs.Qms.set(7.0);
  d.specs.Vas_m3.set(0.03);
  d.specs.Sd_m2.set(0.0133);
  d.specs.Re_ohm.set(5.6);
  d.specs.Xmax_m.set(0.005);
  return d;
}

describe('Gloss — a FRACTION in the file and the model', () => {
  it('the .wdr carries the fraction, and the model holds it unscaled', () => {
    // bugs/archive/BUG_20260814_gloss-unscaled-test-asserts-exact-equality-against-a-computed-not-entered-fixture-value.md —
    // this fixture's ParState marks Gloss 'C' (slot 37): WinISD computed it, so the model
    // legitimately returns its OWN derivation, not the file's literal — the two agree to
    // ~14 significant figures (independent-implementation float noise), never byte-identical.
    // A tolerance far tighter than that noise, but nowhere near 100x, is what actually proves
    // no scaling: this test's real purpose per its own docstring above.
    const text = readFileSync(join(here, '..', '..', '..', '..', 'drivers', 'myprobes', 'per_field_and_misc', 'john-all-noncalc-fields-manually-entered.wdr'), 'utf8');
    const stored = /^Gloss=(.*)$/m.exec(text)?.[1];
    assert.equal(stored, '1.72503712771898', 'fixture must be the WinISD-authored oracle');
    const wd = WinISDDriver.fromWdrIni(text);
    const cell = wd.cell('Gloss');
    assert.equal(cell.state, 'calculated', 'this fixture\'s ParState marks Gloss computed, not entered');
    const parsed = Number(cell.value);
    assert.ok(Number.isFinite(parsed), 'Gloss must parse to a number');
    const relError = Math.abs(parsed - 1.72503712771898) / 1.72503712771898;
    assert.ok(relError < 1e-9,
      `the parser must not scale — got ${cell.value}, file holds 1.72503712771898 ` +
      `(relative error ${relError}); a real ×100/÷100 bug would show as ~1 or ~0.01, not this`);
  });

  it('the engine fills it, so a driver that never carried a Gloss still shows one', () => {
    // Advanced-panel ruling QO24: only alfaVC, Rt and Ct are manual. A driver authored in-app
    // has no `Gloss=` line to carry, so the number on the panel can only come from the solver.
    const d = coreDriver();
    const cell = d.specs.Gloss;
    const value = cell.value;
    if (typeof value !== 'number') {
      assert.fail(`Gloss binds cellVal('Gloss'), which the driver model leaves ${cell.provenance} — the field renders blank`);
    }
    // g/((2π·37)²·0.005) for coreDriver's Fs/Xmax.
    assert.ok(Math.abs(value - 9.80665 / ((2 * Math.PI * 37) ** 2 * 0.005)) < 1e-15);
  });
});
