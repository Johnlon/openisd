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
 *     the hand-picked cases in `winisd-parity-functional.test.ts`.
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
import { OpenISDDriver } from '@openisd/design';
import { Engine } from '@openisd/design/engine';
import { winISDDriverToOpenISDDeviceJson } from '../../domain/openisdSchema.js';
import { openIsdDriverToWinIsdDriver } from '../../winisd/driverYmlToOpenisdAndWdr.js';
import { PARSTATE_LEN, POS_TO_WDRKEY } from '../../winisd/parstate.js';

const here = dirname(fileURLToPath(import.meta.url));
const SAMPLES = join(here, '..', '..', '..', '..', 'drivers', 'sample', 'winisd');

const files = readdirSync(SAMPLES)
  .filter(f => f.endsWith('.wdr'))
  .filter(f => /\[Driver\]/.test(readFileSync(join(SAMPLES, f), 'utf8')));

/**
 * Agreement band for a RECOMPUTED value against WinISD's own.
 *
 * Not the 1e-9 of `winisd-parity-functional.test.ts`: that compares two calculations, this compares our
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

/**
 * `[ENV T=<kelvin> p=<pascal> RH=<percent>]` in `Comment=` — the environment WinISD's own `c`/
 * `roo` were computed under, for a driver-only `.wdr` (no `[Box]` section, so no other field
 * carries it). Real WinISD never writes this tag; it is a human annotation added to a specific
 * oracle file once the true environment was known by other means (see
 * `bugs/BUG_20260907_wdr_c_roo_environment_not_recoverable_on_round_trip.md`), read HERE ONLY,
 * for this test's own comparison — `OpenISDDriver` does not parse or honour it.
 */
function envTagOf(src: string): { tempK: number; pressurePa: number; humidityPct: number } | undefined {
  const m = /\[ENV T=([\d.]+) p=([\d.]+) RH=([\d.]+)\]/.exec(src);
  if (!m) return undefined;
  return { tempK: Number(m[1]), pressurePa: Number(m[2]), humidityPct: Number(m[3]) };
}

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
    // numVC outside 1..4 is coerced to 1 and flagged `numvc-coerced` — `WDR_LOGIC.md`
    // "numVC — read on mark, value checked". Not a loss: the original survives as
    // `actual_reading`, and this check only sees the two round-tripped .wdr keys.
    if (key === 'numVC' && !['1', '2', '3', '4'].includes((before.get(key) ?? '').trim())) continue;
    if (Number(after.get(key)) !== Number(before.get(key))) {
      lost.push(`${file} ${key}: "${before.get(key)}" -> "${after.get(key)}"`);
    }
  }
  return lost;
}

/** text → WinISDDriver → OpenISDDriver → WinISDDriver → text. */
function cycle(src: string): string {
  const asRead = WinISDDriver.fromWdrIni(src);
  const { record } = winISDDriverToOpenISDDeviceJson(asRead);
  const driver = OpenISDDriver.fromConformingRecord(record, new Engine());
  if (Array.isArray(driver)) {
    assert.fail(`record rejected: ${driver.join('; ')}`);
  }
  const rebuilt = openIsdDriverToWinIsdDriver(driver, new Engine(), []);
  return rebuilt.toWdrIni();
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
      const env = envTagOf(src);
      const disagreed: string[] = [];
      for (let pos = 0; pos < PARSTATE_LEN; pos++) {
        const key = POS_TO_WDRKEY[pos];
        if (key == null || state[pos] !== 'C' || !before.has(key)) continue;
        if (UNSOLVED.includes(key) || WRONG_BY_DESIGN.has(file)) continue;
        if (FIELD_DISAGREEMENT_EXCUSED.has(`${file}:${key}`)) continue;
        const theirs = Number(before.get(key));
        // `c`/`roo` on a file carrying an `[ENV]` tag: our own writer always recomputes them at
        // the app default environment (nothing in a driver-only `.wdr` carries the real one), so
        // compare against WinISD's OWN air model at the recorded environment instead of `after`.
        const ours = (env && (key === 'c' || key === 'roo'))
          ? new Engine().airFor({ ...env, useWinisdAirModel: true })[key === 'c' ? 'c' : 'rho']
          : Number(after.get(key));
        if (!isFinite(theirs) || theirs === 0) continue;   // 0 pins no arithmetic
        if (!isFinite(ours) || !agrees(ours, theirs)) {
          disagreed.push(`${key}: WinISD ${before.get(key)}, ours ${ours}`);
        }
      }
      assert.deepEqual(disagreed, [],
        'these are values WinISD calculated and we calculated independently from the same ' +
        'inputs — a disagreement is a difference in the physics, not in the file format');
    });

    /**
     * An `N` slot may be promoted, but only by an actual derivation OR a nonzero value already
     * sitting in the source.
     *
     * `N` -> `C` is legitimate on its own: our solver is more complete than WinISD's, and it
     * fills slots WinISD left alone. Forbidding that would forbid solving.
     *
     * `N` -> `E` on an UNCHANGED value is legitimate exactly when that value is nonzero (John,
     * 2026-09-05: "if a value is non zero then it isn't a hallucination, it's a real value that
     * is either C or E... N vs non-N is solely to distinguish a numeric default from a defined E
     * or C zero"). `N` means WinISD's own numeric default, and that default is always `0`
     * (confirmed empirically: every genuine WinISD-written `.wdr` in this corpus with an
     * `N`-marked field carries `0` there, with no exception among ordinary numeric fields) — so
     * a nonzero value under an `N` mark is real data the mark itself got wrong, not something to
     * distrust or drop. `openisdSchema.ts`'s `shouldImport` already reads it this way on
     * import; this is that same rule, checked again on the way back out.
     *
     * What is still forbidden is the mark WITHOUT the derivation on a value that WAS `0`: `C`
     * claims a computation produced this number, and `0 -> 0` unchanged proves none did.
     *
     * `Sd` is the one exception needing its OWN mark, not this general rule: real WinISD never
     * derives `Sd` from `Dd` or vice versa (`s-dd.wdr` states only `Dd`, leaves `Sd` at `N`, value
     * `0`; `s-sd.wdr` states only `Sd`, leaves `Dd` at `N`, value `0`) — but openisd's solver
     * does derive `Sd` from `Dd`, going beyond WinISD, and the exporter marks that derived `Sd`
     * `E`, never `C` (John, 2026-09-05: "old Sd e and c go to e, old n goes to n"). `Dd`'s own
     * reverse derivation IS marked `C` (`calculable: true`, `winisd/winisdDriver.ts:87`'s
     * comment): the two directions are deliberately asymmetric, and `Sd`'s `0 -> nonzero`
     * transition would otherwise trip "N -> C on an unchanged value" for the wrong reason.
     */
    it(`${file} — N slots stay N unless something was actually derived`, () => {
      const out = cycle(src);
      const outState = parStateOf(out);
      assert.ok(outState, 'the projection must state a ParState');
      const after = pairs(out);

      const invented: string[] = [];
      for (let pos = 0; pos < PARSTATE_LEN; pos++) {
        // Slot 17 is Sd — see the comment above the `it` block.
        if (pos === 17) continue;
        if (state[pos] !== 'N' || outState[pos] === 'N') continue;
        const key = POS_TO_WDRKEY[pos];
        const sourceValue = key != null ? Number(before.get(key)) : NaN;
        const derived = key != null && Number(after.get(key)) !== sourceValue;
        // A nonzero value already in the source is real data under a stale N mark, not
        // something openisd invented — legitimate at E or C, unchanged or not.
        if (isFinite(sourceValue) && sourceValue !== 0) continue;
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
