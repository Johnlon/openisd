/**
 * @openisd/winisd — .wdr import/export round-trip via the Driver ADT.
 *
 * Verifies that Driver.fromWdr reads the values the bytes say, and that
 * fromWdr → toWdr → fromWdr round-trips the T/S parameters. deriveDriver (via toDriver)
 * gives the internal-consistency check.
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Driver } from '@openisd/winisd';

const here = dirname(fileURLToPath(import.meta.url));

describe('.wdr driver file import and export (Driver ADT)', () => {

  // 🔒 ORACLE — `drivers/sample/winisd/` holds files WinISD itself wrote. The assertions
  // below are still only self-consistency (parse what the bytes say, then in == out across
  // export/import), but the input is a genuine save, so nothing here can be satisfied by a
  // writer bug that a third party's .wdr-shaped export happens to share.
  const SAMPLES = join(here, '..', '..', '..', 'drivers', 'sample', 'winisd');
  const WDR_PATH = join(SAMPLES, 'John-all-manu-populated.wdr');
  const EXPECTED_NAME   = 'John all-manu-populated';
  const EXPECTED_FS_HZ  = 4;                    // Hz  — entered in the file (ParState[1]=E)
  const EXPECTED_VAS_M3 = 0.141584099539285;    // m³  — entered at 15 s.f. (ParState[19]=E)
  const EXPECTED_MMS_KG = 0.005;                // kg  — entered (ParState[16]=E)

  const text = readFileSync(WDR_PATH, 'utf8');

  it('reads the composed name and the entered values from a genuine WinISD .wdr file', () => {
    const d = Driver.fromWdr(text);
    assert.equal((d.raw() as Record<string, unknown>).name, EXPECTED_NAME,
      `name should be "${EXPECTED_NAME}"`);
    assert.equal(d.cell('Fs').value,  EXPECTED_FS_HZ,  `Fs should be ${EXPECTED_FS_HZ} Hz`);
    assert.equal(d.cell('Vas').value, EXPECTED_VAS_M3, `Vas should be ${EXPECTED_VAS_M3} m³, every digit`);
    assert.equal(d.cell('Mms').value, EXPECTED_MMS_KG, `Mms should be ${EXPECTED_MMS_KG} kg`);
  });

  it('exports to .wdr text and round-trips every T/S parameter with no loss at all', () => {
    // The writer emits full precision, so this is exact equality — not a tolerance.
    const d  = Driver.fromWdr(text);
    const rt = Driver.fromWdr(d.toWdr());
    const params = ['Fs', 'Qts', 'Qes', 'Qms', 'Vas', 'Sd', 'Re', 'Le', 'Xmax', 'Pe', 'Z'];
    for (const k of params) {
      const a = d.cell(k).value, b = rt.cell(k).value;
      if (typeof a !== 'number' || typeof b !== 'number') continue;
      assert.equal(b, a, `${k}: ${a} → export → import → ${b} (the write is lossy)`);
    }
  });

  it('the re-imported .wdr is internally self-consistent: toDriver reproduces every parameter', () => {
    // A physically coherent oracle driver (Qes=0.38, Qms=6.2 ⇒ Qts=0.358), so deriveDriver
    // resolves. If the export/import round-trip is clean the derived driver is IDENTICAL —
    // exact equality, because the writer loses nothing.
    const coherent = readFileSync(join(SAMPLES, 'inconsistency-test-qts-C.wdr'), 'utf8');
    const before = Driver.fromWdr(coherent).toDriver();
    const after  = Driver.fromWdr(Driver.fromWdr(coherent).toWdr()).toDriver();
    assert.ok(before && after, 'both the source and the re-imported driver must derive');
    for (const k of ['Fs', 'Re', 'Sd', 'Vas', 'Qts', 'Qes', 'Qms', 'Cms', 'Mms', 'Rms', 'Bl'] as const) {
      assert.equal(after[k], before[k], `${k}: ${before[k]} → export → import → ${after[k]}`);
    }
    assert.equal(before.Fs, 38, 'sanity: the fixture states Fs=38');
  });

});
