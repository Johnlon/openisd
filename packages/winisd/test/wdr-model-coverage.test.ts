/**
 * `OpenISDDriver` is a SUPERSET of a `.wdr` — ARCHITECTURE.md §"The same rule binds the DRIVER".
 *
 * OpenISD is WinISD-compatible AND MORE. That is a REQUIREMENT on the model, not an observation
 * about it, so every field a `.wdr` can carry has a home in the OpenISD model. A `.wdr` key with
 * nowhere to go is a hole in the model — this test is what makes the hole visible, by round-
 * tripping every key WinISD writes through the real public seam (`OpenISDDriver.fromWinISDDriver`
 * / `.toWinISDDriver()`) rather than reaching into the mapping table's own internals, which
 * `@openisd/model` keeps private.
 *
 * There are no exemptions, and `c` (speed of sound) and `roo` (air density) are why the rule
 * needs saying. They look like environment constants, so they look exemptable — but WinISD
 * offers both for EDITING on the driver and saves what you type, which makes them driver
 * fields whatever they describe. The `.wpr` agrees: in
 * `docs/winisd_screenshots/sample_project_Epique15_-_pr.wpr` they appear at lines 53-54, INSIDE the
 * `[Driver]` section, not in any project-level one.
 *
 * `c`/`roo`/`EBP` are not special-cased anywhere in the model or the writer — they resolve
 * through the exact same entered-or-computed path (`OpenISDDriver.cell()`) as every other
 * derivable field, filled once, in `@openisd/engine`'s `solveConsistencyGroup`, the ONE place
 * any value is computed.
 *
 * An exemption list is how coverage gets quietly narrowed — park the inconvenient key and the
 * gate goes green over a field still being destroyed. There is no list here.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { WinISDDriver, INI_ROWS } from '../src/winisdDriver.js';
import { CellState } from '../src/parstate.js';
import { OpenISDDriver, Provenance } from '@openisd/model';
import { moistAirDensity, moistAirSoundVelocity, T_REF_K, RH_REF_PCT, P_REF_PA } from '@openisd/engine';

describe('every .wdr field has a home in the OpenISD model', () => {
  it('the key list is real and non-trivial', () => {
    assert.ok(INI_ROWS.length > 40,
      `expected WinISD's full numeric key set, got ${INI_ROWS.length}`);
  });

  it('no .wdr key is unplaceable — every stated value round-trips through OpenISDDriver', () => {
    // Every numeric key stated as ENTERED, each with a distinct non-zero value, so a key that
    // silently lost its home comes back as N (absent) or 0, not the value set here. No key is
    // excluded from the equality check — c, roo, and EBP included — because none of them is
    // special-cased anywhere in the entered-value path.
    const cells = new Map<string, { value: string; state: typeof CellState.Entered }>(
      INI_ROWS.map((key, i) => [key, { value: String(100 + i), state: CellState.Entered }]));
    const wdr = WinISDDriver.build({}, cells);

    const driver = OpenISDDriver.fromWinISDDriver(wdr);
    const { value: roundTripped } = driver.toWinISDDriver();
    if (!roundTripped) throw new Error('round-trip export failed to project');

    const homeless = INI_ROWS.filter(k => {
      const cell = roundTripped.cell(k);
      return cell.state !== CellState.Entered || cell.value !== cells.get(k)!.value;
    });

    assert.deepEqual(homeless, [],
      'OpenISD is WinISD-compatible AND MORE, so a .wdr key with nowhere to go is a hole in ' +
      'the model — not a field to skip. Each of these is silently discarded on the ' +
      'WinISDDriver -> OpenISDDriver -> WinISDDriver round trip, including when the file marks ' +
      'it E (a value a human typed). See ' +
      'bugs/BUG_20260816_cycling_a_wdr_through_openisd_destroys_15_entered_winisd_fields.md ' +
      'and ledger QO48 for which part of the model each one belongs to.');
  });

  it('there is no exemption list — c and roo specifically are covered, not silently parked', () => {
    // c (speed of sound) and roo (air density) are the case a future edit is most likely to
    // "helpfully" exempt: they look like environment constants. They are not exemptable —
    // WinISD offers both for EDITING on the driver and saves what you type, which makes them
    // driver fields whatever they describe (docs/winisd_screenshots/sample_project_Epique15_-_pr.wpr lines
    // 53-54: both appear INSIDE the [Driver] section, not any project-level one). This test
    // pins those two keys by name so a future exemption list added to THIS file, not just the
    // general coverage loop above, would still be caught.
    // Deliberately NOT plausible physics — this is a round-trip-fidelity probe, not a
    // physical-correctness check (that's a different test, against a WinISD oracle value
    // elsewhere in this suite). An obviously-synthetic number makes it unambiguous to a
    // reader that the value itself carries no meaning; only "survives unchanged" does.
    const cCell = { value: '111111', state: CellState.Entered };
    const rooCell = { value: '222222', state: CellState.Entered };
    const wdr = WinISDDriver.build({}, new Map([['c', cCell], ['roo', rooCell]]));

    const driver = OpenISDDriver.fromWinISDDriver(wdr);
    const { value: roundTripped } = driver.toWinISDDriver();
    if (!roundTripped) throw new Error('round-trip export failed to project');

    assert.equal(roundTripped.cell('c').state, CellState.Entered, 'c is written to every .wdr and must round-trip');
    assert.equal(roundTripped.cell('c').value, cCell.value, "c's stated value must survive the round trip");
    assert.equal(roundTripped.cell('roo').state, CellState.Entered, 'roo is written to every .wdr and must round-trip');
    assert.equal(roundTripped.cell('roo').value, rooCell.value, "roo's stated value must survive the round trip");
  });

  it('c and roo, left unentered, come back live-computed at the reference environment, marked COMPUTED', () => {
    // No cells at all — this is what a .wdr with no c/roo lines (or any lines) looks like.
    // `@openisd/engine`'s `solveConsistencyGroup` fills c/roo by computing them live from the
    // CIPM-2007 moist-air model at the reference environment when unset, unconditionally
    // marked `C` — there is no stored constant anywhere (AGENTS.md 'Calculation logic —
    // permission gate' sign-off 2026-08-19). `winisd` itself supplies neither value.
    const refC = moistAirSoundVelocity(T_REF_K, RH_REF_PCT, P_REF_PA);
    const refRho = moistAirDensity(T_REF_K, RH_REF_PCT, P_REF_PA);
    const wdr = WinISDDriver.build({}, new Map());

    const driver = OpenISDDriver.fromWinISDDriver(wdr);
    const { value: roundTripped } = driver.toWinISDDriver();
    if (!roundTripped) throw new Error('round-trip export failed to project');

    assert.equal(roundTripped.cell('c').state, CellState.Computed, 'unentered c must read as computed, not absent');
    assert.equal(Number(roundTripped.cell('c').value), refC, "unentered c must default to the live reference-environment speed of sound");
    assert.equal(roundTripped.cell('roo').state, CellState.Computed, 'unentered roo must read as computed, not absent');
    assert.equal(Number(roundTripped.cell('roo').value), refRho, "unentered roo must default to the live reference-environment air density");
  });

  it('entering then clearing c/roo on the SAME OpenISDDriver: entered value reads back, cleared reverts to the live reference-environment value', () => {
    const refC = moistAirSoundVelocity(T_REF_K, RH_REF_PCT, P_REF_PA);
    const refRho = moistAirDensity(T_REF_K, RH_REF_PCT, P_REF_PA);
    const driver = OpenISDDriver.fromJsonRecord({
      uuid: { value: 'x', definition: 'd' },
      quality: { rating: 'M', confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [], parse_errors: [], cross_source_only: [] },
      manufacturer: { value: '', origin: 'manual', definition: 'd', dq: [] },
      brand: { value: '', origin: 'manual', definition: 'd', dq: [] },
      model: { value: '', origin: 'manual', definition: 'd', dq: [] },
      sku: { value: '', definition: 'd', grounds: [] },
      driver_type: { value: 'woofer', origin: 'manual', definition: 'd', dq: [] },
      data_sources: { value: {}, definition: 'd' },
      authoritative: { value: 'manual', definition: 'd' },
      specs: { woofer: {} },
    });

    // ENTER: same object, both fields.
    driver.enterC(400);
    driver.enterRoo(1.5);
    assert.deepEqual(driver.cCell(), { value: 400, state: Provenance.Entered, origin: 'manual' },
      'c must read back exactly what was just entered, on the same object');
    assert.deepEqual(driver.rooCell(), { value: 1.5, state: Provenance.Entered, origin: 'manual' },
      'roo must read back exactly what was just entered, on the same object');

    // CLEAR: same object, both fields. c/roo resolve through the SAME entered-or-computed
    // path as any other spec field (`solveConsistencyGroup` fills both when unset) — no
    // export step is needed to see the engine constant; `cell()` alone already returns it.
    driver.clearC();
    driver.clearRoo();
    assert.equal(driver.cCell().state, Provenance.Calculated, 'a cleared c reads computed directly off the driver, like any other derivable field');
    assert.equal(driver.cCell().value, refC, "a cleared c reads the live reference-environment speed of sound directly off the driver");
    assert.equal(driver.rooCell().state, Provenance.Calculated, 'a cleared roo reads computed directly off the driver, like any other derivable field');
    assert.equal(driver.rooCell().value, refRho, "a cleared roo reads the live reference-environment air density directly off the driver");

    const { value: exported } = driver.toWinISDDriver();
    if (!exported) throw new Error('export failed to project');
    assert.equal(exported.cell('c').state, CellState.Computed, 'the same computed c carries through to .wdr export unchanged');
    assert.equal(Number(exported.cell('c').value), refC, "the same computed c value carries through to .wdr export unchanged");
    assert.equal(exported.cell('roo').state, CellState.Computed, 'the same computed roo carries through to .wdr export unchanged');
    assert.equal(Number(exported.cell('roo').value), refRho, "the same computed roo value carries through to .wdr export unchanged");
  });

  it('OpenISDDriver.toWinISDDriver() never drifts out of sync with WinISDDriver about the key set', () => {
    // Regression guard for exactly the bug missingKeys() exists to catch: OpenISDDriver's own
    // fill-loop and WinISDDriver's INI_ROWS must agree on every key. If they ever drift, this
    // is where it would show up — as a warning in errors, not a silent gap or a thrown error.
    const driver = OpenISDDriver.empty();
    const { value: wdr, errors } = driver.toWinISDDriver();
    if (!wdr) throw new Error('export failed to project');

    assert.deepEqual(wdr.missingKeys(), [], 'OpenISDDriver must supply every .wdr key WinISDDriver tracks');
    assert.deepEqual(errors.filter(e => e.message.includes('drifted out of sync')), [],
      'a key-set drift must never actually occur in the real export path');
  });

  it('WinISDDriver built directly with an incomplete cells map degrades gracefully, not silently', () => {
    // The case missingKeys() exists to make visible: a caller (a test, or a future producer)
    // that skips a key. Export must still succeed — no thrown error — but the gap is reported.
    const wdr = WinISDDriver.build({}, new Map([['Fs', { value: '40', state: CellState.Entered }]]));

    assert.ok(wdr.missingKeys().length > 40, 'every key but Fs is missing from this deliberately incomplete build');
    assert.ok(wdr.missingKeys().includes('roo'), 'roo specifically must be reported missing, not silently defaulted');

    const text = wdr.toWdr();
    assert.match(text, /^Fs=40$/m, 'the one key that was supplied still exports correctly');
    assert.match(text, /^roo=0$/m, 'a missing key still exports gracefully, as the format placeholder 0 — not thrown, not omitted');
  });
});
