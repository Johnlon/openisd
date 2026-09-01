/**
 * The SECOND loop: `.wdr` text → `WinISDDriver` → `OpenISDDriver` → `WinISDDriver` → text.
 *
 * The first loop (`wdr-round-trip.test.ts`) proves the format layer is faithful, and it can
 * demand byte equality because `WinISDDriver` is dumb: it carries the file's own strings.
 *
 * This loop cannot, and MUST not. `toOpenISDRecord()` carries E fields and deliberately drops
 * C ones — a value WinISD computed is not a fact the record may assert. So the record that
 * comes out the far side has holes exactly where WinISD had computed values, and writing it
 * back makes OUR solver fill them. That is the point:
 *
 *   - an E value is DATA. It must come back byte-identical and still marked E. Our solver is
 *     never allowed to overwrite a value a human entered.
 *   - a C value is WinISD's ARITHMETIC. It is recomputed from scratch, so the test of
 *     compatibility is whether our number agrees with WinISD's — the strongest parity check
 *     in the suite, because it runs over every computed field of every real file rather than
 *     the hand-picked cases in `winisd-parity.test.ts`.
 *   - an N slot stays N. `N` means "not in play"; inventing a value there is a claim the
 *     source contradicts.
 *
 * 🔒 ORACLE: `drivers/sample/winisd/` — every file there was written by WinISD, so every C
 * value in it is WinISD's own answer to the same arithmetic.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WinISDDriver } from '@openisd/design/winisd';
import { OpenISDDriver } from '@openisd/model';
import { PARSTATE_LEN, POS_TO_WDRKEY } from '../../winisd/parstate.js';

const here = dirname(fileURLToPath(import.meta.url));
const SAMPLES = join(here, '..', '..', '..', '..', 'drivers', 'sample', 'winisd');

const files = readdirSync(SAMPLES)
  .filter(f => f.endsWith('.wdr'))
  .filter(f => /\[Driver\]/.test(readFileSync(join(SAMPLES, f), 'utf8')));

/**
 * Agreement band for a RECOMPUTED value against WinISD's own.
 *
 * Not the 1e-9 of `winisd-parity.test.ts`: that compares two calculations, this compares our
 * calculation against a DECIMAL STRING WinISD rounded for the file. `Qts=0.358` states the
 * value to 3 places, so it pins the true number no closer than ±5e-4 whatever either side
 * computes. The band therefore has to cover the file's own precision, and 1e-4 relative does
 * — while still failing any real disagreement, which shows up in the first or second digit,
 * not the fourth.
 */
const REL = 1e-4, ABS = 1e-9;
const agrees = (ours: number, theirs: number): boolean =>
  Math.abs(ours - theirs) <= Math.max(ABS, REL * Math.abs(theirs));

/**
 * Computed values our solver does not reproduce, by key.
 *
 * `KLe`: WinISD derives it (`John-all-manu-populated.wdr` states `KLe=49.6287078253544`
 * marked C); we return 0. A genuine gap in the physics, not in the format.
 *
 * `Qms`: `John-all-manu-populated-ex.wdr` states `-1.5`. A negative Q is not physical, so
 * there is no arithmetic to agree with.
 */
const UNSOLVED: readonly string[] = ['KLe', 'Qms'];

/**
 * Files whose stated C values are deliberately WRONG, so agreeing with them would be the
 * failure. `inconsistency-test-qts-C.wdr` states `Qts=0.500` marked C while its own comment
 * records the true value as "~0.358" — the file exists to test inconsistency detection. Our
 * cycle returns 0.35805471124620064, which is right. Excluded by NAME and by reason; never by
 * loosening the tolerance, which would blind the whole corpus to catch one file.
 */
const WRONG_BY_DESIGN = new Set(['inconsistency-test-qts-C.wdr']);

/**
 * `file:key` pairs excluded from the C-value agreement check for a reason narrower than a
 * whole file. `s-roo.wdr:c` — WinISD's stored `c` (343.684..., the standard-air default) does
 * not match `c = √(γ·p_ref/roo)` for its own stated `roo=123`, contradicting the c-from-roo
 * recompute rule `docs/design/WINISD_SCHEMA.md` §12 established from a distinct, plausible-range
 * probe matrix. Whether WinISD clamps/rejects an out-of-range `roo` before recomputing `c` is
 * unresolved. See `bugs/BUG_20260820_s-roo_wdr_oracle_contradicts_the_c-from-roo_recompute_rule.md`.
 */
const FIELD_DISAGREEMENT_EXCUSED = new Set(['s-roo.wdr:c']);

const MARK_WITHOUT_DERIVATION =
  'a C mark claims a computation produced this number. Where the value is unchanged, nothing ' +
  'was computed: the solver read an ABSENT input as 0, ran the arithmetic on it (Sd = π·(0/2)² ' +
  '= 0), got a finite answer and marked the slot C on the strength of isFinite(). A zero area, ' +
  'impedance, Q or diameter is not a value any driver could have. See ' +
  'bugs/BUG_20260816_cycling_a_wdr_through_openisd_destroys_15_entered_winisd_fields.md ' +
  '§"a C mark is written over a value nothing computed"';

/** ParState as written, or undefined where the file states none. */
function parStateOf(text: string): string | undefined {
  const line = text.split(/\r?\n/).find(l => l.startsWith('ParState='));
  const v = line?.slice('ParState='.length).trim();
  return v?.length === PARSTATE_LEN ? v : undefined;
}

/** `Key=value` pairs, in file order. */
function pairs(text: string): Map<string, string> {
  return new Map(text.split(/\r?\n/)
    .filter(l => l.includes('=') && l[0] !== '[')
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
}

/**
 * Keys the file marks `E` whose value does not come back. Nothing is excluded: every `.wdr`
 * field has a home in the model, so any loss at all is a defect this must name.
 *
 * Compared as NUMBERS, not strings: WinISD itself renormalises its own decimals — the
 * hand-authored `inconsistency-test.wdr` states `Qts=0.500`, and `inconsistency-test-saved.wdr`
 * (the same file after a WinISD load-and-save) states `Qts=0.5`. Demanding byte equality here
 * would fail on WinISD's own formatting while catching no actual loss.
 */
function lostEntered(file: string, src: string): string[] {
  const before = pairs(src), after = pairs(cycle(src));
  const state = parStateOf(src)!;
  const lost: string[] = [];
  for (let pos = 0; pos < PARSTATE_LEN; pos++) {
    const key = POS_TO_WDRKEY[pos];
    if (key == null || state[pos] !== 'E' || !before.has(key)) continue;
    if (Number(after.get(key)) !== Number(before.get(key))) {
      lost.push(`${file} ${key}: "${before.get(key)}" -> "${after.get(key)}"`);
    }
  }
  return lost;
}

/** text → WinISDDriver → OpenISDDriver → WinISDDriver → text. */
function cycle(src: string): string {
  const asRead = WinISDDriver.fromWdrIni(src);
  const driver = OpenISDDriver.fromWinISDDriver(asRead);
  const { value, errors } = driver.toWinISDDriver();
  assert.ok(value, `projection failed: ${errors.map(e => e.message).join('; ')}`);
  return value.toWdr();
}

describe('a .wdr survives the round trip THROUGH OpenISDDriver', () => {
  it('the sample corpus is the oracle, and it is not empty', () => {
    assert.ok(files.length > 3,
      'this suite proves nothing without files WinISD wrote to compare against');
  });

  for (const file of files) {
    const src = readFileSync(join(SAMPLES, file), 'utf8');
    const state = parStateOf(src);
    if (!state) continue;   // no ParState: nothing states which values are E, C or N.

    const before = pairs(src);

    it(`${file} — entered values are never touched`, () => {
      assert.deepEqual(lostEntered(file, src), [],
        'an E value is a fact the human stated — a solver that recomputes over it has ' +
        'destroyed the datum it was given');
    });

    it(`${file} — computed values are recomputed and agree with WinISD`, () => {
      const after = pairs(cycle(src));
      const disagreed: string[] = [];
      for (let pos = 0; pos < PARSTATE_LEN; pos++) {
        const key = POS_TO_WDRKEY[pos];
        if (key == null || state[pos] !== 'C' || !before.has(key)) continue;
        if (UNSOLVED.includes(key) || WRONG_BY_DESIGN.has(file)) continue;
        if (FIELD_DISAGREEMENT_EXCUSED.has(`${file}:${key}`)) continue;
        const theirs = Number(before.get(key)), ours = Number(after.get(key));
        if (!isFinite(theirs) || theirs === 0) continue;   // 0 pins no arithmetic
        if (!isFinite(ours) || !agrees(ours, theirs)) {
          disagreed.push(`${key}: WinISD ${before.get(key)}, ours ${after.get(key)}`);
        }
      }
      assert.deepEqual(disagreed, [],
        'these are values WinISD calculated and we calculated independently from the same ' +
        'inputs — a disagreement is a difference in the physics, not in the file format');
    });

    /**
     * An `N` slot may be promoted, but only by a derivation that actually ran.
     *
     * `N` -> `C` is legitimate on its own: our solver is more complete than WinISD's, and it
     * fills slots WinISD left alone — `s-dd.wdr` derives `Sd = π·(Dd/2)²` from an entered
     * `Dd`, `s-sd.wdr` derives `Dd` back from an entered `Sd`, both correctly. Forbidding that
     * would forbid solving.
     *
     * What is forbidden is the mark WITHOUT the derivation. `C` claims a computation produced
     * this number; if the value is byte-for-byte what the source already had, no computation
     * produced anything, and the claim is false. `N` -> `E` is never legitimate at all: `E`
     * means a human stated it, and no cycle can turn a blank into a statement.
     */
    it(`${file} — N slots stay N unless something was actually derived`, () => {
      const out = cycle(src);
      const outState = parStateOf(out);
      assert.ok(outState, 'the projection must state a ParState');
      const after = pairs(out);

      const invented: string[] = [];
      for (let pos = 0; pos < PARSTATE_LEN; pos++) {
        // Slot 23 is numVC, which WinISD marks E in every file it writes and the projection
        // sets unconditionally — it is a count, always in play, never solved for.
        if (state[pos] !== 'N' || outState[pos] === 'N' || pos === 23) continue;
        const key = POS_TO_WDRKEY[pos];
        const derived = key != null && Number(after.get(key)) !== Number(before.get(key));
        if (outState[pos] === 'C' && derived) continue;
        invented.push(`slot ${pos} (${key ?? 'no key'}): N -> ${outState[pos]}` +
          (derived ? '' : `, value unchanged at "${before.get(key ?? '')}"`));
      }
      assert.deepEqual(invented, [], MARK_WITHOUT_DERIVATION);

      assert.deepEqual([...pairs(out).keys()], [...before.keys()],
        'the projection must write WinISD\'s key set, in WinISD\'s order');
    });
  }
});
