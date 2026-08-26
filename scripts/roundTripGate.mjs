/**
 * roundTripGate.mjs — the bundle-time round-trip gate (plan `shiny-noodling-kahan.md`
 * "Round-trip gate in the openisd bundler"): every `openisd.yml` the bundler bundles, and
 * separately every tools-generated `.wdr` reachable from the same corpus root, must survive a
 * round trip through the app's OWN load/serialise code with no divergence.
 *
 * Pure, side-effect-free (no filesystem read here — callers hand in text/records already
 * read), so `bundle-drivers.mjs`'s own per-record loop can call `checkOpenisdRoundTrip`
 * inline with the record it already parsed, and a test can call either function directly with
 * no fixture files.
 *
 * Calls ONLY the app's real functions — `OpenISDDriver.fromJsonRecord`/`.toOwdrJson()` for the
 * openisd.yml leg (`checkOpenisdRoundTrip` takes the already-parsed record, since
 * `bundle-drivers.mjs`'s own loop needs that same parsed object for other purposes too), and
 * `OpenISDDriver.fromWdrText`/`.toWdrText()` for the .wdr leg.
 * This script runs inside the same Node/vite-node process as the rest of the bundler, so it
 * imports `@openisd/model` directly rather than crossing the V8-bridge boundary the tools side
 * needs — same functions, no V8 round trip to duplicate.
 */
import { OpenISDDriver } from '@openisd/model';

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
  const aKeys = Object.keys(a), bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length || aKeys.some((k, i) => k !== bKeys[i])) {
    return `${path} (key order/set differs: [${aKeys}] vs [${bKeys}])`;
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
  let reserialisedText;
  try {
    reserialisedText = OpenISDDriver.fromJsonRecord(record).toOwdrJson();
  } catch (e) {
    return { ok: false, message: `${relPath}: openisd.yml record shape rejected by OpenISDDriver.fromJsonRecord: ${e}` };
  }
  let reserialisedRecord;
  try {
    reserialisedRecord = JSON.parse(reserialisedText);
  } catch (e) {
    return { ok: false, message: `${relPath}: toOwdrJson() produced unparseable JSON: ${e}` };
  }
  const divergence = firstDivergence(record, reserialisedRecord);
  if (divergence) {
    return { ok: false, message: `${relPath}: round-trip mismatch at ${divergence}` };
  }
  return { ok: true };
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
  let driver;
  try {
    driver = OpenISDDriver.fromWdrText(wdrText);
  } catch (e) {
    return { ok: false, message: `${relPath}: could not read .wdr (fromWdrText threw): ${e}` };
  }
  const { value: reserialised, errors } = driver.toWdrText();
  const blocking = errors.filter(e => e.level === 'error');
  if (reserialised == null || blocking.length > 0) {
    return { ok: false, message: `${relPath}: .wdr projection failed: ${blocking.map(e => e.message).join('; ') || 'no value returned'}` };
  }

  const before = pairs(wdrText), after = pairs(reserialised);
  const beforeKeys = [...before.keys()], afterKeys = [...after.keys()];
  if (beforeKeys.length !== afterKeys.length || beforeKeys.some((k, i) => k !== afterKeys[i])) {
    return { ok: false, message: `${relPath}: re-parse-equal (QT60) key-order mismatch — before [${beforeKeys}], after [${afterKeys}]` };
  }
  for (const key of beforeKeys) {
    const b = before.get(key), a = after.get(key);
    const bNum = Number(b), aNum = Number(a);
    const equal = isFinite(bNum) && isFinite(aNum) ? bNum === aNum : b === a;
    if (!equal) {
      return { ok: false, message: `${relPath}: re-parse-equal (QT60) value mismatch at ${key}: "${b}" -> "${a}"` };
    }
  }
  return { ok: true };
}
