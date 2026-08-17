/**
 * `OpenISDDriver` is a SUPERSET of a `.wdr` — ARCHITECTURE.md §"The same rule binds the DRIVER".
 *
 * OpenISD is WinISD-compatible AND MORE. That is a REQUIREMENT on the model, not an observation
 * about it, so every field a `.wdr` can carry has a home in the OpenISD model. A `.wdr` key with
 * nowhere to go is a hole in the model — this test is what makes the hole visible instead of
 * letting `toOpenISDRecord()` walk past it with a `continue`.
 *
 * There are no exemptions, and `c` (speed of sound) and `roo` (air density) are why the rule
 * needs saying. They look like environment constants, so they look exemptable — but WinISD
 * offers both for EDITING on the driver and saves what you type, which makes them driver
 * fields whatever they describe. The `.wpr` agrees: in
 * `docs/winisd/sample_project_Epique15_-_pr.wpr` they appear at lines 53-54, INSIDE the
 * `[Driver]` section, not in any project-level one.
 *
 * An exemption list is how coverage gets quietly narrowed — park the inconvenient key and the
 * gate goes green over a field still being destroyed. There is no list here.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { NUMERIC_DEFAULTS, SPEC_TO_WDR } from '../src/winisdDriver.js';

/** Keys with a home in the driver record, by construction: `SPEC_TO_WDR` IS that mapping. */
const specKeys = new Set(SPEC_TO_WDR.map(([, wdrKey]) => wdrKey));

/** `.wdr` keys carrying a value, which is every key WinISD writes bar `ParState` itself. */
const wdrKeys = NUMERIC_DEFAULTS.map(([key]) => key);

describe('every .wdr field has a home in the OpenISD model', () => {
  it('the key list is real and non-trivial', () => {
    assert.ok(wdrKeys.length > 40,
      `expected WinISD's full numeric key set, got ${wdrKeys.length}`);
  });

  it('no .wdr key is unplaceable', () => {
    const homeless = wdrKeys.filter(k => !specKeys.has(k));

    assert.deepEqual(homeless, [],
      'OpenISD is WinISD-compatible AND MORE, so a .wdr key with nowhere to go is a hole in ' +
      'the model — not a field to skip. Each of these is silently discarded by ' +
      'toOpenISDRecord(), including when the file marks it E (a value a human typed). See ' +
      'bugs/BUG_20260816_cycling_a_wdr_through_openisd_destroys_15_entered_winisd_fields.md ' +
      'and ledger QO48 for which part of the model each one belongs to.');
  });

  it('there is no exemption list — every key is covered, including c and roo', () => {
    // An exemption list is how coverage gets quietly narrowed: park the inconvenient key, and
    // the gate goes green over a field that is still being destroyed. `c` and `roo` are the
    // case in point — WinISD writes both into every .wdr, so "they are really environment
    // constants" is true and still not a reason for the record of that FILE to lose them.
    for (const k of ['c', 'roo']) {
      assert.ok(specKeys.has(k), `${k} is written to every .wdr and must round-trip`);
    }
  });
});
