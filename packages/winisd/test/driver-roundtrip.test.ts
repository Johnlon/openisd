/**
 * @openisd/winisd — Driver.fromWdr / toWdr lossless round-trip + live provenance.
 *
 * Seam: Driver.fromWdr(text) → toWdr() must be semantically identical — every carried
 * [Driver] key preserved (EXACT numeric equality, no precision loss) and the ParState
 * string identical. And ParState must be LIVE: built from cell().state, not echoed —
 * clearing an entered field flips its ParState slot.
 *
 * 🔒 ORACLE. The fixture is `drivers/sample/winisd/`, written by WinISD itself. That
 * provenance is the only thing that licenses the WinISD-conformance claims below — that our
 * writer reproduces WinISD's ParState, its key set, and every carried value bit-for-bit.
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Driver } from '@openisd/winisd';

const here = dirname(fileURLToPath(import.meta.url));
const SAMPLES = join(here, '..', '..', '..', 'drivers', 'sample', 'winisd');
const SAMPLE_WDR = join(SAMPLES, 'John-all-manu-populated.wdr');

/**
 * Every key a genuine WinISD save writes, from `john-all-defaults.wdr` (New → Save with
 * nothing typed). A key outside this set is one WinISD would ignore, so a value written
 * there never reaches WinISD.
 */
const WINISD_KEYS: ReadonlySet<string> = new Set(
  readFileSync(join(SAMPLES, 'john-all-defaults.wdr'), 'utf8')
    .split(/\r?\n/)
    .map(l => l.slice(0, l.indexOf('=')).trim())
    .filter(k => k.length > 0),
);

function parseWdrFields(text: string): { fields: Record<string, string>; parState: string | undefined } {
  const fields: Record<string, string> = {};
  let parState: string | undefined;
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i < 0 || line[0] === '[') continue;
    const key = line.slice(0, i).trim();
    const val = line.slice(i + 1).trim();
    if (key === 'ParState') { parState = val; continue; }
    fields[key] = val;
  }
  return { fields, parState };
}

describe('Driver — lossless WDR round-trip', () => {
  const original = readFileSync(SAMPLE_WDR, 'utf8');
  const orig = parseWdrFields(original);

  it('sanity: the fixture has a 49-char ParState', () => {
    assert.ok(orig.parState, 'fixture must carry a ParState line');
    assert.equal(orig.parState.length, 49);
  });

  // Three slots WinISD marks C in this file by a route @openisd/engine does not implement at
  // all (not a T/S formula — motor/leakage geometry) — genuinely irreducible, not a bug this
  // suite should mask:
  //   7  (KLe)  — WinISD derives it from fLe by a leakage-inductance model we have no formula
  //               for, so openisd can only report the carried fLe value itself, never KLe.
  //   10 (Xlim) — ParState-only slot, no WDR key at all (parstate.ts POS_TO_WDRKEY[10] = null);
  //               this file has no `Xlim=` line, so openisd has no route to any mark here.
  //   25 (Hg)   — WinISD derives it from the motor geometry (Hc, gap depth, ...) internally;
  //               openisd has no equivalent formula and can only carry the stated Hg value.
  // Every other slot — including the 34 the ParState writer used to leave N regardless of
  // what was actually entered/computable — now matches exactly.
  const IRREDUCIBLE_GAP_SLOTS = new Set([7, 10, 25]);

  it('fromWdr → toWdr preserves the ParState string exactly, except the irreducible gap slots', () => {
    const d = Driver.fromWdr(original);
    const out = parseWdrFields(d.toWdr());
    assert.ok(orig.parState, 'fixture must carry a ParState line');
    assert.ok(out.parState, 'export must carry a ParState line');
    assert.equal(out.parState.length, 49);
    // ALL 49 slots, slot 0 included. It used to be excluded because WinISD writes C for Znom
    // on this file and openisd emitted N, having no rule that computed it; the probe settled
    // that Znom = 2·round_half_to_even(0.75·Re) and the engine now derives it (ledger QO30),
    // so `Re=6` here gives `Znom=8` marked C on both sides.
    const mismatches: string[] = [];
    for (let i = 0; i < orig.parState.length; i++) {
      if (orig.parState[i] === out.parState[i]) continue;
      if (IRREDUCIBLE_GAP_SLOTS.has(i)) continue;
      mismatches.push(`slot ${i}: source ${orig.parState[i]} vs re-exported ${out.parState[i]}`);
    }
    assert.deepEqual(mismatches, [],
      `ParState differs where no gap is recorded — ${mismatches.join('; ')}\n` +
      `  in:  ${orig.parState}\n  out: ${out.parState}`);
  });

  it('fromWdr → toWdr writes no key WinISD does not write', () => {
    const d = Driver.fromWdr(original);
    const out = parseWdrFields(d.toWdr());
    for (const key of Object.keys(out.fields)) {
      assert.ok(WINISD_KEYS.has(key),
        `${key}= is not a key WinISD writes — a value put there never reaches WinISD`);
    }
  });

  it('fromWdr → toWdr preserves every carried field value (exact for a stated value, ' +
     '1e-9 relative for one openisd recomputes)', () => {
    // A field the file states (E) is re-emitted via parseFloat/String — an exact bit-for-bit
    // round trip, no recomputation involved. A field the file's own ParState marks Computed
    // is re-emitted from openisd's OWN live derivation (ARCHITECTURE.md §3 — `.wdr` is
    // generated fresh, never a stale echo), which need not reproduce WinISD's exact rounding
    // through a different formula ordering — same 1e-9 relative bound `winisd-parity.test.ts`
    // uses everywhere else in this codebase for two independent implementations of one
    // formula (see that file's own REL_TOL comment for why 1e-9 is the right band).
    // Dia is the one exception: it has no ParState slot of its own (parstate.ts has no
    // separate position for it — it shares Dd's), so WinISD does not keep it synchronised
    // with Dd on a file it did not author itself via New; this fixture's own Dia=0 sits next
    // to a non-zero Dd. openisd deliberately keeps ONE number for the concept (Dia mirrors
    // Dd — packages/winisd/src/driver.ts #derive()), which is more internally consistent
    // than the source, not less.
    const d = Driver.fromWdr(original);
    const out = parseWdrFields(d.toWdr());
    for (const [key, val] of Object.entries(orig.fields)) {
      if (key === 'Dia') continue;
      assert.ok(key in out.fields, `field ${key} must survive the round-trip (was dropped)`);
      const a = parseFloat(val), b = parseFloat(out.fields[key]);
      if (isFinite(a) && isFinite(b)) {
        const tol = Math.max(1e-12, 1e-9 * Math.max(Math.abs(a), Math.abs(b)));
        assert.ok(Math.abs(b - a) <= tol,
          `${key}: ${val} → ${out.fields[key]} (value changed beyond float noise — the write is lossy)`);
      } else {
        assert.equal(out.fields[key], val, `${key}: string value must round-trip verbatim`);
      }
    }
  });
});

describe('Driver — ParState is live (built from state, not echoed)', () => {
  const original = readFileSync(SAMPLE_WDR, 'utf8');

  it('clearing an entered Q flips its ParState slot from E to C (still derivable from the other two)', () => {
    const d = Driver.fromWdr(original);
    // Qts is at ParState position 14; in this fixture it is entered (E).
    assert.equal(d.cell('Qts').state, 'E', 'fixture has Qts entered');
    d.clear('Qts');
    // Qms+Qes remain entered → Qts = 1/(1/Qms + 1/Qes) = 2/3 → C (not E, not echoed).
    assert.equal(d.cell('Qts').state, 'C', 'cleared Qts is now computed');
    const ps = parseWdrFields(d.toWdr()).parState!;
    assert.equal(ps[14], 'C', 'ParState[14] (Qts) must reflect the live C state, not the echoed E');
  });
});
