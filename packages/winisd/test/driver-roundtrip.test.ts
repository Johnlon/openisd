/**
 * @openisd/winisd — Driver.fromWdr / toWdr lossless round-trip + live provenance.
 *
 * Seam: Driver.fromWdr(text) → toWdr() must be semantically identical — every carried
 * [Driver] key preserved (numeric equality) and the ParState string byte-identical.
 * And ParState must be LIVE: built from cell().state, not echoed — clearing an entered
 * field flips its ParState slot.
 *
 * Fixture: a real scraped driver with a full 49-char ParState (independent source of
 * truth — written by the Python scraper, not by the code under test).
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Driver } from '@openisd/winisd';

const here = dirname(fileURLToPath(import.meta.url));
const SAMPLE_WDR = join(here, '..', '..', '..', 'drivers', 'sample', 'SEAS_Prestige_L19RNX1.wdr');

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
    assert.equal(out.parState, orig.parState,
      `ParState must round-trip identically\n  in:  ${orig.parState}\n  out: ${out.parState}`);
  });

  it('fromWdr → toWdr preserves every carried field value (numeric equality)', () => {
    const d = Driver.fromWdr(original);
    const out = parseWdrFields(d.toWdr());
    for (const [key, val] of Object.entries(orig.fields)) {
      assert.ok(key in out.fields, `field ${key} must survive the round-trip (was dropped)`);
      const a = parseFloat(val), b = parseFloat(out.fields[key]);
      if (isFinite(a) && isFinite(b)) {
        assert.ok(Math.abs(a - b) <= Math.abs(a) * 1e-9 + 1e-12,
          `${key}: ${val} → ${out.fields[key]} (numeric drift)`);
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
    // Qms is at ParState position 12; in this fixture it is entered (E).
    assert.equal(d.cell('Qms').state, 'E', 'fixture has Qms entered');
    d.clear('Qms');
    // Qes+Qts remain entered → Qms is now derivable → C (not E, not echoed).
    assert.equal(d.cell('Qms').state, 'C', 'cleared Qms is now computed');
    const ps = parseWdrFields(d.toWdr()).parState!;
    assert.equal(ps[12], 'C', 'ParState[12] (Qms) must reflect the live C state, not the echoed E');
  });
});
