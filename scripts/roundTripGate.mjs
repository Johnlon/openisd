/**
 * roundTripGate.mjs — the bundle-time round-trip gate (plan `shiny-noodling-kahan.md`
 * "Round-trip gate in the openisd bundler"): every `openisd.yml` the bundler bundles must survive
 * a round trip through the app's OWN load/serialise code with no divergence. A WDR round-trip is
 * checked only for WDR text produced by this bridge, never by scanning unrelated corpus files.
 *
 * Pure, side-effect-free (no filesystem read here — callers hand in text/records already
 * read), so `bundle-drivers.mjs`'s own per-record loop can call `checkOpenisdRoundTrip`
 * inline with the record it already parsed, and a test can call either function directly with
 * no fixture files.
 *
 * Calls ONLY the app's real functions — `OpenISDDriver.fromConformingRecord`/
 * `.toOpenIsdDeviceJson()` for the openisd.yml leg (`checkOpenisdRoundTrip` takes the
 * already-parsed record, since `bundle-drivers.mjs`'s own loop needs that same parsed object for
 * other purposes too), and `OpenISDDriver.fromWdrIniText`/`toWdrIniText` for
 * the .wdr leg.
 * This script runs inside the same Node/vite-node process as the rest of the bundler, so it
 * imports `@openisd/design` directly rather than crossing the V8-bridge boundary the tools side
 * needs — same functions, no V8 round trip to duplicate.
 */
import {OpenISDDriver, OpenISDPassiveRadiatorStandalone} from '@openisd/design';
import {Engine} from '@openisd/design/engine';

/**
 * Whether `a` is a legacy `SpecEntryJson` — `{origin, readings, ...}`, no `state` key — and `b`
 * is its loaded shape gaining exactly `state`/`value` (S2-7b, T11: "one value, one flag"). The
 * gain is checked against the winning reading before this counts as expected, so an ACTUAL
 * mismatch (wrong value, wrong flag) still falls through to the ordinary key-set/value report.
 */
function isExpectedSpecEntryUpgrade(a, b) {
  if (typeof a !== 'object' || a === null || Array.isArray(a)) return false;
  if (typeof b !== 'object' || b === null || Array.isArray(b)) return false;
  if (typeof a.origin !== 'string' || typeof a.readings !== 'object' || a.readings === null) return false;
  if (!('state' in b) || !('value' in b)) return false;
  const winning = a.readings[a.origin];
  const expectedValue = winning && typeof winning === 'object' ? winning.read_value : undefined;
  return b.state === 'E' && b.value === expectedValue;
}

/**
 * Whether `b` carries a `dq_calculated` key `a` does not — S2-7d2's driver DQ projection: every
 * `resolve()` now also writes the group's own formula onto whichever ENTERED fields its OWN
 * consistency check flags (an over-determined group, e.g. a stated `Fs`/`Mms`/`Cms` triple that
 * cannot all be true at once), something no earlier task did. A THIRD instance of the same
 * one-time-gain class the two checks above already carve out: the entry's `state`/`value` (or
 * its whole self, for a brand-new calculated key) is unchanged, it has simply gained a warning
 * the source file predates. Checked generically, not only inside the legacy-upgrade branch below,
 * since a field's OWN shape needing no upgrade does not mean its group has no inconsistency to
 * flag.
 */
function isExpectedDqGain(a, b) {
  if (typeof a !== 'object' || a === null || Array.isArray(a)) return false;
  if (typeof b !== 'object' || b === null || Array.isArray(b)) return false;
  if ('dq_calculated' in a) return false;
  return 'dq_calculated' in b && Array.isArray(b.dq_calculated);
}

/** Whether `v` is a `state:'C'` `SpecEntryJson` — a quantity the driver's own `resolve()`
 *  (S2-7c) derived, never a fact materialising from nowhere. `{state, value}` is a shape
 *  nothing else in an openisd record uses (metadata is `{value, origin}`; `sku` is
 *  `{value, grounds}`), so matching it is a safe, narrow test. */
function isCalculatedEntry(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    && v.state === 'C' && typeof v.value === 'number';
}

/**
 * Deep-compares two JSON-shaped values and returns a slash-separated path string naming the
 * FIRST point they diverge, or `null` if they are identical. Used to report exactly where an
 * openisd.yml round trip went wrong, not merely that it did.
 */
export function firstDivergence(a, b, path = '$') {
  if (a === b) return null;
  if (typeof a !== typeof b) return `${path} (type ${typeof a} vs ${typeof b})`;
  if (a == null || b == null) return `${path} (${JSON.stringify(a)} vs ${JSON.stringify(b)})`;
  if (typeof a !== 'object') return `${path} (${JSON.stringify(a)} vs ${JSON.stringify(b)})`;
  if (Array.isArray(a) !== Array.isArray(b)) return `${path} (array-ness differs)`;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return `${path}.length (${a.length} vs ${b.length})`;
    for (let i = 0; i < a.length; i++) {
      const d = firstDivergence(a[i], b[i], `${path}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  // A legacy spec entry gaining `state`/`value` on load (S2-7b) is a documented ONE-TIME GAIN of
  // information, the same class of exception `maskVCCon` below already makes for `.wdr`'s VCCon
  // slot — never re-checked past this call, since `read.toOpenIsdDeviceJson()` always re-emits an
  // entered entry the same way from here on. Everything else about the entry (`origin`,
  // `readings`, `corroboration`, `dq_scraper`, `dq_calculated`) is still compared, unchanged.
  if (isExpectedSpecEntryUpgrade(a, b)) {
    const { state: _state, value: _value, ...bRest } = b;
    return firstDivergence(a, bRest, path);
  }
  if (isExpectedDqGain(a, b)) {
    const { dq_calculated: _dq, ...bRest } = b;
    return firstDivergence(a, bRest, path);
  }
  // S2-7c (T11 "the record is a cache the solver keeps current"): loading now RESOLVES the
  // driver once, writing every quantity the engine can derive from the stated ones back into
  // `specs.<section>` as a brand-new `state:'C'` key the source file never had at all — a
  // SECOND, larger instance of the same one-time-gain class as the upgrade above, not loss:
  // every key the source DID state is still required below, byte-for-byte. A new key is
  // tolerated ONLY when it is a genuine calculated entry; an 'E' fact appearing from nowhere is
  // not this case and still fails the gate.
  if (!Array.isArray(a)) {
    const aKeySet = new Set(Object.keys(a));
    const gainedCalculatedKeys = Object.keys(b).filter(k => !aKeySet.has(k) && isCalculatedEntry(b[k]));
    if (gainedCalculatedKeys.length > 0) {
      const bWithoutGained = { ...b };
      for (const k of gainedCalculatedKeys) delete bWithoutGained[k];
      return firstDivergence(a, bWithoutGained, path);
    }
  }
  // KEY SET, not key order. Order is the EMITTER's contract — `canonical_yaml`'s
  // `_KEY_PRIORITY_LIST` decides it, and the schema is declared to match — so a record written
  // before that order last changed differs here for a reason this gate is not about. What this
  // gate is about is LOSS: a key or a value that does not survive the app's own reader.
  const aKeys = Object.keys(a).sort(), bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length || aKeys.some((k, i) => k !== bKeys[i])) {
    return `${path} (key set differs: [${aKeys}] vs [${bKeys}])`;
  }
  for (const k of aKeys) {
    const d = firstDivergence(a[k], b[k], `${path}.${k}`);
    if (d) return d;
  }
  return null;
}

/**
 * `record` — the already-YAML-parsed openisd.yml object, held onto by `bundle-drivers.mjs`'s own
 * loop for other purposes (`project(record)`, the bundled `files` entry), so this function takes
 * the parsed object rather than raw YAML text — `OpenISDDriver.fromOwdrYml(text)` would parse it
 * a second time for nothing. `relPath` — for the failure message only. Round trip:
 * `OpenISDDriver.fromJsonRecord(record).toOwdrJson()`, `JSON.parse`d back, compared against
 * `record` at the DATA level.
 *
 * NOT a byte comparison against the original `openisd.yml` FILE TEXT: this leg compares the
 * JSON-shaped record before and after, not the YAML text — a direct YAML-to-YAML byte comparison
 * is what `OpenISDDriver.fromOwdrYml(text).toOwdrYml()` is for, and belongs to the caller that
 * holds the original file text, not to this function which is handed an already-parsed object.
 * Data-level equality between the parsed record and the reserialised-then-reparsed one is the
 * meaningful bar here: it still fails on ANY data loss or alteration the app's own code
 * introduces.
 */
export function checkOpenisdRoundTrip(record, relPath) {
  // Through the DOMAIN's own seam, which is the app's one reader of a record. What comes back is
  // the schema's OUTPUT — an object rebuilt key by key from what the schema declares — so any key
  // the app cannot model shows up here as a divergence rather than being lost in silence.
  const engine = new Engine();
  const device = OpenISDDriver.fromConformingRecord(record, engine);
  const radiator = Array.isArray(device) ? OpenISDPassiveRadiatorStandalone.fromConformingRecord(record, engine) : null;
  const read = Array.isArray(device) ? radiator : device;
  if (read === null || Array.isArray(read)) {
    const problems = Array.isArray(read) ? read : device;
    return { ok: false, message: `${relPath}: openisd.yml record refused by the domain: ${problems.join('; ')}` };
  }
  // A PASSIVE RADIATOR is checked for CONFORMANCE only. `toOpenIsdDeviceJson()` is declared on
  // `OpenISDDriver` and not on the radiator class, so there is nothing to re-serialise through —
  // the record was accepted by the radiator seam, which is the same strict schema, but the
  // key-by-key comparison below cannot run. Adding that one method to the radiator would close
  // the gap; it is an API addition to packages/design and needs John's approval.
  if (typeof read.toOpenIsdDeviceJson !== 'function') return { ok: true, device: read };

  const reserialisedRecord = read.toOpenIsdDeviceJson();
  const divergence = firstDivergence(record, reserialisedRecord);
  if (divergence) {
    return { ok: false, message: `${relPath}: round-trip mismatch at ${divergence}` };
  }
  // The opened device travels back so the bundler can write its index row from the same object
  // the gate proved — one open per record, no second parse.
  return { ok: true, device: read };
}

/**
 * Header lines `OpenISDDriver.fromWinISDDriver` (`packages/model/src/openisdDriver.ts:442-477`)
 * does not read back on import: it reads only `brand`/`model`/`manufacturer` off the header
 * (`headerField('brand')` etc.), and `Comment` on export is `this.description()` — a value
 * COMPUTED from the record, not a fact stored anywhere for a later import to recover. These
 * four are one-way by the reader's own design, confirmed by reading `fromWinISDDriver`'s body:
 * excluding them from the QT60 comparison is not a loosened bar, it is the bar QT60 actually
 * describes (the 48-key numeric table + ParState), applied to fields the reader is documented
 * to skip.
 */
const ONE_WAY_HEADER_LINES = new Set(['Comment', 'ProvidedBy', 'DateAdded', 'DateModified']);

/** ParState slot 46 — `VCCon`. */
const VCCON_SLOT = 46;

/**
 * ParState with the `VCCon` slot masked out, so a round trip is compared on every other slot.
 *
 * `VCCon` is the one field a reader consults by PRESENCE rather than by its mark: slot 46 is
 * unproven — no probing shows WinISD ever writing it — so reading back a `VCCon=` row our writer
 * marked `N` yields `entered`, and the slot moves `N` -> `E` once and is then stable. That is
 * documented at `packages/design/winisd/driverYmlToOpenisdAndWdr.ts:240-247` as a one-time gain of
 * certainty rather than a loss, and `wdrDriverDiffs` in that same file already excludes the field
 * for it; this gate makes the same exception rather than reporting the intended flip as a defect.
 */
function maskVCCon(parState) {
  if (typeof parState !== 'string' || parState.length <= VCCON_SLOT) return parState;
  return parState.slice(0, VCCON_SLOT) + '?' + parState.slice(VCCON_SLOT + 1);
}

/** `Key=value` pairs from `.wdr`/INI text, in file order — the QT60 "re-parse-equal" unit:
 *  values and key order after parsing, not raw bytes (WinISD itself renormalises decimals, so
 *  demanding byte equality would fail on formatting while catching no actual loss). */
function pairs(text) {
  return new Map(text.split(/\r?\n/)
    .filter(l => l.includes('=') && l[0] !== '[')
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
    .filter(([key]) => !ONE_WAY_HEADER_LINES.has(key)));
}

/**
 * `wdrText` — the tools-generated `.wdr` file's own text, as read from disk. `relPath` — for
 * the failure message. Round trip: `OpenISDDriver.fromWdrText(wdrText).toWdrText()`, compared
 * against `wdrText` at the QT60 re-parse-equal bar: same keys, same order, same values once
 * parsed as numbers where both sides parse as numbers, else same string.
 */
export function checkWdrRoundTrip(wdrText, relPath) {
  // Through the DOMAIN, not through a raw INI parse-and-print. `WinISDDriver.fromWdrIni().toWdrIni()`
  // echoes the cells it parsed, so every value would be compared against itself and a stated C
  // (computed) value disagreeing with its own inputs would pass. Reading into an `OpenISDDriver`
  // and writing back out re-derives the computed fields from the entered ones, which is the
  // divergence this gate exists to catch — and is the exact pair the app's own import/export runs
  // (`packages/ui/src/logic/fileImportExport.ts`).
  const engine = new Engine();
  const { value: driver, errors: readErrors } = OpenISDDriver.fromWdrIniText(wdrText, engine);
  if (driver === null) {
    return { ok: false, message: `${relPath}: could not read .wdr: ${readErrors.map(e => e.message).join('; ') || 'no driver returned'}` };
  }
  const { value: reserialised, errors } = driver.toWdrIniText(engine);
  if (reserialised == null) {
    const blocking = errors.filter(e => e.level === 'error');
    return { ok: false, message: `${relPath}: .wdr projection failed: ${blocking.map(e => e.message).join('; ') || 'no value returned'}` };
  }

  const before = pairs(wdrText), after = pairs(reserialised);
  const beforeKeys = [...before.keys()], afterKeys = [...after.keys()];
  if (beforeKeys.length !== afterKeys.length || beforeKeys.some((k, i) => k !== afterKeys[i])) {
    return { ok: false, message: `${relPath}: re-parse-equal (QT60) key-order mismatch — before [${beforeKeys}], after [${afterKeys}]` };
  }
  for (const key of beforeKeys) {
    const b = key === 'ParState' ? maskVCCon(before.get(key)) : before.get(key);
    const a = key === 'ParState' ? maskVCCon(after.get(key)) : after.get(key);
    const bNum = Number(b), aNum = Number(a);
    const equal = isFinite(bNum) && isFinite(aNum) ? bNum === aNum : b === a;
    if (!equal) {
      return { ok: false, message: `${relPath}: re-parse-equal (QT60) value mismatch at ${key}: "${b}" -> "${a}"` };
    }
  }
  return { ok: true };
}
