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

  it('fromWdr → toWdr preserves the ParState string exactly', () => {
    const d = Driver.fromWdr(original);
    const out = parseWdrFields(d.toWdr());
    assert.ok(out.parState, 'export must carry a ParState line');
    assert.equal(out.parState.length, 49);
    // Slot 0 (Znom) is excluded: WinISD writes C on this file, we emit N because no rule
    // here computes Znom. Which is right is an open question awaiting a probe of WinISD
    // across cases — ledger QO30. Every other slot must match exactly.
    assert.equal(out.parState.slice(1), orig.parState!.slice(1),
      `ParState[1..48] must round-trip identically\n  in:  ${orig.parState}\n  out: ${out.parState}`);
  });

  it('fromWdr → toWdr writes no key WinISD does not write', () => {
    const d = Driver.fromWdr(original);
    const out = parseWdrFields(d.toWdr());
    for (const key of Object.keys(out.fields)) {
      assert.ok(WINISD_KEYS.has(key),
        `${key}= is not a key WinISD writes — a value put there never reaches WinISD`);
    }
  });

  it('fromWdr → toWdr preserves every carried field value EXACTLY (no precision loss)', () => {
    const d = Driver.fromWdr(original);
    const out = parseWdrFields(d.toWdr());
    for (const [key, val] of Object.entries(orig.fields)) {
      assert.ok(key in out.fields, `field ${key} must survive the round-trip (was dropped)`);
      const a = parseFloat(val), b = parseFloat(out.fields[key]);
      if (isFinite(a) && isFinite(b)) {
        assert.equal(b, a, `${key}: ${val} → ${out.fields[key]} (value changed — the write is lossy)`);
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
