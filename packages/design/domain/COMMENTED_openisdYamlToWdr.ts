// COMMENTED OUT — the duplicated `.wdr` export, written against `packages/model`'s driver.
//
// It calls `toOwdrJson()`, `fromOwdrJson()`, `fromOwdrYml()` and names `Cell` — none of which
// `packages/design`'s `OpenISDDriver` has, and none of which it should: those were the model's
// four unvalidated entry points onto one operation. The file had no consumer, and its import of
// `./openisdDriver.js` did not resolve, so 54 type errors sat behind a missing module.
//
// It comes back when the WDR export is rebuilt on the design driver — see
// docs/plans/PLAN_DELETE_PACKAGES_MODEL.md. Kept, rather than deleted, because it carries the
// format knowledge that rebuild needs.

// /**
//  * `openisd.yml` text -> `.wdr` text, direct — the seam `winisd_tools` calls in-process
//  * (embedded V8) to generate the `.wdr` it stores in `winisd_drivers`.
//  *
//  * Composes the three pieces the V8 bridge needs strung together: YAML parse, record shape
//  * check, `OpenISDDriver.fromJsonRecord`, `OpenISDDriver.toWdrText()` (itself
//  * `toWinISDDriver().toWdr()`). `errors` names what is missing when the projection cannot
//  * complete, the YAML does not parse to an OpenISD record, or the record's interior does not
//  * match the shape `OpenISDDriver`'s getters assume (bugs/BUG_20260822_openisddriver_getters_throw_on_a_record_that_has_specs_but_not_the_spec_entry_shape.md,
//  * OPEN — `fromJsonRecord` does not itself validate; this function catches around the whole
//  * composition as the interim so this seam still honours `value` null / never-throws); `value`
//  * is null then.
//  *
//  * Returns a STRING. The V8 boundary carries strings, not bytes — a caller that needs to write
//  * `.wdr` file bytes (the `0xA4` `Comment=` newline sentinel, CP1252/UTF-8 discrimination) must
//  * go through `winisdTextToBytes`/`winisdBytesToText` in `@openisd/winisd`'s `winisdBytes.ts`; this
//  * function does not touch that boundary at all.
//  *
//  * ── This is the ONE production entry point — self-validating, so `winisd_tools`'s entire job
//  *    is "call this, check `errors`" ──
//  *
//  * `winisd_tools` calls this function once per corpus record (thousands of times, the whole
//  * `winisd_drivers/db` corpus) to generate the `.wdr` it writes to disk. Rather than the caller
//  * separately re-reading that file back and comparing it itself, this function runs BOTH
//  * round-trip checks internally, on every call, and folds every divergence into the SAME
//  * `errors` array the projection already returns — the caller never parses YAML, never diffs a
//  * record, never calls a second function:
//  *
//  *   1. **`yml-round-trip`** — `fromJsonRecord(record) -> toOwdrJson() -> fromOwdrJson() ->
//  *      toOwdrYml() -> fromOwdrYml() -> toOwdrJson()`, parsed back and compared against the
//  *      ORIGINAL parsed `record` at the data level, STRICT equality (no tolerance — this leg
//  *      exercises BOTH real serialisation pairs `OpenISDDriver` has — JSON for
//  *      localStorage/the share-link, YAML for `.owdr` file save/load — each via its own
//  *      matching read method, never a generic stand-in). Any divergence is a real defect:
//  *      `level: 'error'`, field `yml-round-trip`.
//  *
//  *   2. **`wdr-round-trip`** — `toWdrText() -> fromWdrText()`, re-reading the very `.wdr` text
//  *      this function is about to return, compared against the ORIGINAL driver at the `cell()`
//  *      level for every `@openisd/winisd` `INI_ROWS` field the original record STATED
//  *      (`CellState.Entered`). `.wdr` is a minimal 49-slot numeric format
//  *      (`docs/plans/OPENISD_TARGET_MIGRATION_PLAN.md` Step 8): it carries no `uuid`, no
//  *      provenance, no `dq`, no `data_sources`, no `product_image`, no `description`, no
//  *      driver-type discriminator (a passive-radiator or full-range record reads back as a
//  *      plain `woofer` section), and no spec field outside `INI_ROWS` (`freq_low_hz`,
//  *      `freq_high_hz`, `power_peak_W`, `voice_coil_dia_mm`, `weight_kg` observed lost in real
//  *      corpus fixtures, `packages/winisd/test/fixtures/openisd/{e150he-44,w5-1138smf}.openisd.yml`).
//  *      Comparing the full record here would fail on nearly every field of nearly every record —
//  *      not because the projection is wrong, but because `.wdr` was never designed to carry that
//  *      data (`bugs/BUG_20260824_wdr_round_trip_always_loses_the_original_comment_field.md` in
//  *      `winisd_tools`, filed against the sibling `Comment` header case: `toWinISDDriver()`
//  *      writes `Comment=` from `description()`, a value DERIVED from the record, never the
//  *      record's own `comment` field, and `fromWinISDDriver()` never reads `Comment` back in at
//  *      all — one-way by the reader's own design, the same reasoning
//  *      `scripts/roundTripGate.mjs`'s `ONE_WAY_HEADER_LINES` already encodes for its own
//  *      `.wdr`-vs-`.wdr` QT60 comparison). Scoping to `INI_ROWS`-tracked, originally-STATED
//  *      fields is that same bar applied here: the set of things `.wdr` actually promises to
//  *      carry, checked against what it actually carried — every such field survived exactly,
//  *      byte-for-value, in every fixture this was checked against (both
//  *      `packages/winisd/test/fixtures/openisd/` samples and real corpus records `grs/8fr-8`,
//  *      `tang-band/pr01`, `accuton/asp190` — the last two passive-radiator). Both
//  *      `CellState.Entered` AND `CellState.Calculated` `INI_ROWS` fields are compared — NOT
//  *      only Entered ones: every field that can feed `solveConsistencyGroup`/
//  *      `deriveOpenISDFields` is itself an `INI_ROWS` member (confirmed: `Xlim`, `OuterX`,
//  *      `OuterY`, `freq_low_hz`, `freq_high_hz`, `power_peak_W`, `weight_kg` — the only
//  *      `SpecSection` fields outside `INI_ROWS` — are referenced nowhere in
//  *      `@openisd/engine`'s `solver.ts`), so the Entered-field agreement this check already
//  *      establishes IS the solver's entire input set; re-deriving from an identical input set
//  *      through the same deterministic pure function must reproduce the identical Calculated
//  *      value, and a divergence is a real defect. `numVC`/`VCCon` never reach the comparison as
//  *      Calculated — neither is ever a solver output, so their own state is always Entered or
//  *      NotAvailable. Any mismatch is a real defect: `level: 'error'`, field
//  *      `wdr-round-trip:<field>`.
//  *
//  * Both checks are purely additive: the `value` returned is always the ORIGINAL fresh
//  * projection (computed once, never re-derived from either check's own re-read), so the
//  * external contract — what gets written to disk — is unchanged by this validation. A caller
//  * that wants a clean corpus record needs only: call this function, and treat any `error`-level
//  * entry (whichever field it names) as `rebuild_error.alert`-worthy.
//  *
//  * Cost: one extra `toOwdrJson`/`fromOwdrJson`/`toOwdrYml` chain, one extra `fromWdrText`, and a
//  * fixed `INI_ROWS.length` (49) `cell()` comparison, per call — all in-process with no I/O. This
//  * runs once per corpus record (thousands of times) in the production emit pipeline, so the
//  * addition is not free, but it is the cheapest possible shape of "prove the record this
//  * function is about to hand out actually survives its own serialisation surfaces": no extra
//  * file read, no extra network call, and — now that the comparison lives here instead of in the
//  * caller — no second YAML parse or dict-diff in Python either. No flag, no opt-in — always on,
//  * per instruction.
//  */
// import { parse } from 'yaml';
// import type { DriverError, Result } from '@openisd/design/engine';
// import { INI_ROWS } from '@openisd/winisd';
// import { OpenISDDriver } from './openisdDomain.js';
//
// /** Deep-compares two JSON-shaped values; returns a slash-separated path naming the FIRST point
//  *  they diverge, or `null` if identical. Same idea as `scripts/roundTripGate.mjs`'s
//  *  `firstDivergence` (that script cannot be imported here — it is a bundler-only `.mjs`, not
//  *  part of this package's published surface — so this is the model-side twin, kept minimal:
//  *  reporting the first divergence is enough for a `DriverError` message; a corpus sweep that
//  *  wants every divergence at once reads them one record at a time). */
// function firstDivergence(a: unknown, b: unknown, path = '$'): string | null {
//   if (a === b) return null;
//   if (typeof a !== typeof b) return `${path} (type ${typeof a} vs ${typeof b})`;
//   if (a == null || b == null || typeof a !== 'object') return `${path} (${JSON.stringify(a)} vs ${JSON.stringify(b)})`;
//   const aArr = Array.isArray(a), bArr = Array.isArray(b);
//   if (aArr !== bArr) return `${path} (array-ness differs)`;
//   if (aArr && bArr) {
//     if (a.length !== b.length) return `${path}.length (${a.length} vs ${b.length})`;
//     for (let i = 0; i < a.length; i++) {
//       const d = firstDivergence(a[i], b[i], `${path}[${i}]`);
//       if (d) return d;
//     }
//     return null;
//   }
//   const aObj = a as Record<string, unknown>, bObj = b as Record<string, unknown>;
//   const keys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);
//   for (const k of keys) {
//     const d = firstDivergence(aObj[k], bObj[k], `${path}.${k}`);
//     if (d) return d;
//   }
//   return null;
// }
//
// /** `record` — the already-parsed original openisd.yml. Round-trips `driver` through
//  *  `.toOwdrJson() -> fromOwdrJson() -> .toOwdrYml() -> fromOwdrYml() -> .toJsonRecord()` and
//  *  compares the result against `record` at the data level, strict equality. Every real
//  *  serialisation pair `OpenISDDriver` has is exercised by its OWN matching method, never a
//  *  generic stand-in: `toOwdrJson`/`fromOwdrJson` (localStorage autosave, the share-link
//  *  payload) AND `toOwdrYml`/`fromOwdrYml` (`.owdr` file save/load). See this file's own
//  *  docstring for why this leg tolerates nothing. */
// function ymlRoundTripErrors(driver: OpenISDDriver, record: unknown): DriverError[] {
//   let reparsed: unknown;
//   try {
//     const jsonText = driver.toOwdrJson();
//     const driver2 = OpenISDDriver.fromOwdrJson(jsonText);
//     const ymlText = driver2.toOwdrYml();
//     const driver3 = OpenISDDriver.fromOwdrYml(ymlText);
//     reparsed = JSON.parse(driver3.toOwdrJson());
//   } catch (e) {
//     return [{ level: 'error', field: 'yml-round-trip',
//       message: `openisd.yml/json round trip failed: ${String(e)}` }];
//   }
//   const divergence = firstDivergence(record, reparsed);
//   if (!divergence) return [];
//   return [{ level: 'error', field: 'yml-round-trip',
//     message: `record diverges from itself after a yml/json round trip at ${divergence}` }];
// }
//
// /** Re-reads `wdrText` (the `.wdr` this function is about to return, projected from `driver`)
//  *  and reports any `INI_ROWS` field `driver` STATED (`CellState.Entered`) that did not survive
//  *  the round trip unchanged. See this file's own docstring for what is and is not in scope and
//  *  why. Never throws: `OpenISDDriver.fromWdrText` is built on `WinISDDriver.fromWdrIni`, which
//  *  is documented never to throw on malformed `.wdr` text, but this function is still the LAST
//  *  line before returning to the corpus pipeline, so a defensive catch turns any surprise into
//  *  one reported error rather than crashing the emit for one record out of a whole corpus run. */
// /** Dispatch an `INI_ROWS` field name to its flat `OpenISDDriver` accessor — `SpecField` never
//  *  crosses this file's boundary (human ruling 2026-08-24, ENCAPSULATION_AND_LAYERING.md); this
//  *  is the one place a runtime field-name loop needs every field's `Cell`, so the dispatch lives
//  *  here rather than as a keyed method on the class. */
// function driverFieldCell(driver: OpenISDDriver, key: string): Cell {
//   switch (key) {
//     case 'Qts': return driver.spec[driver.section].Qts;
//     case 'Znom': return driver.spec[driver.section].Znom_ohm;
//     case 'Fs': return driver.spec[driver.section].Fs_hz;
//     case 'Pe': return driver.spec[driver.section].Pe_W;
//     case 'SPL': return driver.spec[driver.section].SPL_dB;
//     case 'Re': return driver.spec[driver.section].Re_ohm;
//     case 'Le': return driver.spec[driver.section].Le_H;
//     case 'fLe': return driver.spec[driver.section].fLe_hz;
//     case 'KLe': return driver.spec[driver.section].KLe_H_sqrtHz;
//     case 'BL': return driver.spec[driver.section].BL_Tm;
//     case 'Xmax': return driver.spec[driver.section].Xmax_m;
//     case 'Cms': return driver.spec[driver.section].Cms_m_per_N;
//     case 'Qms': return driver.spec[driver.section].Qms;
//     case 'Qes': return driver.spec[driver.section].Qes;
//     case 'Rms': return driver.spec[driver.section].Rms_kg_per_s;
//     case 'Mms': return driver.spec[driver.section].Mms_kg;
//     case 'Sd': return driver.spec[driver.section].Sd_m2;
//     case 'Vas': return driver.spec[driver.section].Vas_m3;
//     case 'Dia': return driver.spec[driver.section].Dia_m;
//     case 'Vd': return driver.spec[driver.section].Vd_m3;
//     case 'no': return driver.spec[driver.section].no;
//     case 'Dd': return driver.spec[driver.section].Dd_m;
//     case 'EBP': return driver.spec[driver.section].EBP_hz;
//     case 'numVC': return driver.spec[driver.section].numVC;
//     case 'Hc': return driver.spec[driver.section].Hc_m;
//     case 'Hg': return driver.spec[driver.section].Hg_m;
//     case 'SPLmax': return driver.spec[driver.section].SPLmax_dB;
//     case 'SPLmaxLF': return driver.spec[driver.section].SPLmaxLF_dB;
//     case 'USPL': return driver.spec[driver.section].USPL_dB;
//     case 'alfaVC': return driver.spec[driver.section].alfaVC_per_K;
//     case 'Rt': return driver.spec[driver.section].Rt_K_per_W;
//     case 'Ct': return driver.spec[driver.section].Ct_J_per_K;
//     case 'gamma': return driver.spec[driver.section].gamma_m_per_s2_A;
//     case 'Rme': return driver.spec[driver.section].Rme_kg_per_s;
//     case 'Mpow': return driver.spec[driver.section].Mpow_N_per_sqrtW;
//     case 'Mcost': return driver.spec[driver.section].Mcost_kg_per_s;
//     case 'Gloss': return driver.spec[driver.section].Gloss;
//     case 'VCCon': return driver.spec[driver.section].VCCon;
//     case 'c': return driver.spec[driver.section].c_m_per_s;
//     case 'roo': return driver.spec[driver.section].roo_kg_per_m3;
//     case 'Thick': return driver.spec[driver.section].Thick_m;
//     case 'Depth': return driver.spec[driver.section].Depth_m;
//     case 'MagDepth': return driver.spec[driver.section].MagDepth_m;
//     case 'Magnet': return driver.spec[driver.section].Magnet_m;
//     case 'Basket': return driver.spec[driver.section].Basket_m;
//     case 'Outer': return driver.spec[driver.section].Outer_m;
//     case 'Vcd': return driver.spec[driver.section].Vcd_m;
//     case 'DVol': return driver.spec[driver.section].DVol_m3;
//     default: return { value: null, state: CellState.NotAvailable };
//   }
// }
//
// function wdrRoundTripErrors(driver: OpenISDDriver, wdrText: string): DriverError[] {
//   let reread: OpenISDDriver;
//   try {
//     reread = OpenISDDriver.fromWdrText(wdrText);
//   } catch (e) {
//     return [{
//       level: 'error', field: 'wdr-round-trip',
//       message: `could not re-read the .wdr this projection just produced: ${String(e)}`,
//     }];
//   }
//   const errors: DriverError[] = [];
//   for (const key of INI_ROWS) {
//     const before = driverFieldCell(driver, key);
//     // Entered fields: value must survive byte-for-value — `.wdr` promises to carry exactly
//     // what was stated. Calculated fields: also compared, NOT skipped — every field that can
//     // feed `solveConsistencyGroup`/`deriveOpenISDFields` (packages/model/src/openisdDerive.ts)
//     // is itself an `INI_ROWS` member, so the Entered set this loop already proves identical
//     // between `driver` and `reread` is the SOLVER'S ENTIRE INPUT SET; re-deriving from an
//     // identical input set through the same deterministic pure function must reproduce the
//     // identical Calculated value. A divergence here is a real defect (non-determinism, or a
//     // hidden input this reasoning missed), never the solver's own legitimate input-set
//     // difference — that concern only applied when `reread` could have LESS input than
//     // `driver`, which the Entered-field check above already rules out for every `INI_ROWS`
//     // field. `numVC`/`VCCon` are excluded from ever reaching this comparison as Calculated:
//     // neither is a `solveConsistencyGroup` output (confirmed: not referenced in
//     // `@openisd/engine`'s `solver.ts`), so `before.state` for either is always `Entered` or
//     // `NotAvailable`, never `Calculated`.
//     if (before.state === CellState.NotAvailable) continue;
//     const after = driverFieldCell(reread, key);
//     // ParState (`.wdr`'s E/C/N letter) is checked too, not just the number: a `C` field must
//     // come back `C`, not merely carry the same value by coincidence while its provenance
//     // silently changed underneath it (e.g. NotAvailable, if `reread` turned out unable to
//     // re-derive it) — `fromWinISDDriver` only ever admits a `C`-marked cell back in by
//     // re-deriving it fresh (openisdDriver.ts:472), never as a stated reading, so `Calculated`
//     // is the only state that mismatch could hide behind a value coincidence.
//     if (after.value !== before.value || after.state !== before.state) {
//       const kind = before.state === CellState.Entered ? 'stated' : 'derived';
//       const stateNote = after.state !== before.state
//         ? ` [state ${before.state} -> ${after.state}]` : '';
//       errors.push({
//         level: 'error', field: `wdr-round-trip:${key}`,
//         message: `${key}: ${kind} value ${before.value} did not survive the .wdr round trip ` +
//           `(re-read as ${after.value === null ? 'absent' : after.value}${stateNote})`,
//       });
//     }
//   }
//   return errors;
// }
//
// export function openisdYamlToWdr(yamlText: string): Result<string> {
//   const err = (field: string, message: string): DriverError => ({ level: 'error', field, message });
//   let record: unknown;
//   try {
//     // `logLevel: 'error'` because this function is the V8-bridge boundary: the `yaml`
//     // package's default `'warn'` calls `console.warn` on parser warnings, and the bridge runs
//     // inside a host (py-mini-racer) whose console it knows nothing about and whose output no
//     // caller can read. Diagnostics leave through the returned `errors` instead — the only
//     // channel that reaches the caller.
//     // NOT `'silent'`: that level also stops the parser THROWING on malformed input, so a
//     // broken document would return a partial record and convert to a hollow `.wdr` instead of
//     // being reported. Warnings off, errors still raised.
//     record = parse(yamlText, { logLevel: 'error' });
//   } catch (e) {
//     return { value: null, errors: [err('yaml', `could not parse openisd.yml: ${String(e)}`)] };
//   }
//   if (record == null || typeof record !== 'object' || !('specs' in record)) {
//     return { value: null, errors: [err('yaml', 'openisd.yml did not parse to a record')] };
//   }
//   // Interim per BUG_20260822 (see docstring): `fromJsonRecord`/its getters throw on a record
//   // whose `specs` interior is not the `SpecEntry` shape (`specs: {woofer: {fs: 12}}` — a
//   // plausible V8-bridge input). The right fix is `fromJsonRecord` refusing that shape itself
//   // (`Result<OpenISDDriver>`), which reaches its callers in `@openisd/model` and
//   // `packages/ui/src/logic` (managedProject.ts, useApplicationIO.ts); this catch is the
//   // acknowledged interim — the bug stays OPEN.
//   let driver: OpenISDDriver;
//   let projection: Result<string>;
//   try {
//     // `OpenISDDriver.fromOwdrYml(yamlText)` — the same `.owdr`/`openisd.yml` construction
//     // `.owdr` file load uses. `record` above exists only for the pre-check error message and
//     // as `ymlRoundTripErrors`' comparison baseline, never as this construction's input.
//     driver = OpenISDDriver.fromOwdrYml(yamlText);
//     // `.toWdrText()` is inside this same try: its `cell()` calls are where a `specs` interior
//     // of the wrong shape actually throws (BUG_20260822 — `fromJsonRecord` itself does not
//     // validate), not the construction above.
//     projection = driver.toWdrText();
//   } catch (e) {
//     return { value: null, errors: [err('specs', `openisd.yml record shape rejected: ${String(e)}`)] };
//   }
//   const { value, errors } = projection;
//   const checks: DriverError[] = [
//     ...ymlRoundTripErrors(driver, record),
//     ...(value != null ? wdrRoundTripErrors(driver, value) : []),
//   ];
//   return { value, errors: [...errors, ...checks] };
// }
//