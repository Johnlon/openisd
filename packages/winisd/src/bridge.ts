/**
 * V8-loadable entry point for the embedded-V8 boundary `winisd_tools` calls in-process
 * (winisd_tools/DESIGN.md §12.5/§12.6). Built into a single self-contained IIFE by
 * `npm run build:bridge` (packages/winisd/vite.bridge.config.ts →
 * packages/winisd/dist/openisd-bridge.js) and evaluated once per process inside a bare V8
 * context that has no `console`, `process`, `fetch`, `require` or module loader.
 *
 * `globalThis.openisdYamlToWdr`, `globalThis.roundTripOpenIsdYml` and `globalThis.roundTripWdr`
 * are the THREE globals this file adds — the properties mini-racer's Python caller reads and
 * calls (`ctx.call("openisdYamlToWdr", [yamlText])`, and likewise for the other two). This is a
 * deliberate, spec-mandated exception to ARCHITECTURE.md §5 "NO GLOBAL VARIABLES": the whole
 * point of this file is to publish symbols a foreign V8 embedding can find with no import
 * machinery of its own, matching the existing `window.selfTestDone` precedent — named
 * exceptions, scoped to exactly this file, for exactly this reason. QT69.1 originally ruled the
 * bridge exposes exactly ONE function; John's later instruction (plan `shiny-noodling-kahan.md`
 * "Bridge round-trip API for the tools") supersedes it to add the round-trip pair below — record
 * the amendment against QT69 in the winisd_tools ledger when wiring the tools-side caller.
 *
 * Contract (pinned by John, 2026-08-22): the exposed function takes `yamlText: string` and
 * returns a JSON STRING — not an object — so the value crosses the mini-racer boundary as a
 * plain string with no structured marshalling. Parsed, that string is
 * `{ wdr: string | null, errors: DriverError[] }`. `wdr` is the `.wdr`/INI text, or `null`
 * when a blocking error prevented projection. `errors` is always an array (never
 * null/undefined; empty means clean) of `{ level: 'error'|'warn', field: string,
 * message: string }` — `@openisd/engine`'s `DriverError` shape, unchanged. A successful
 * projection can still carry `warn` entries (e.g. the OpenISDDriver/WinISDDriver
 * `INI_ROWS` drift alarm raised alongside a perfectly good `.wdr` —
 * `packages/model/src/openisdDriver.ts:377,382,420`); the JSON envelope is what keeps those
 * reaching the Python caller instead of a bare string silently dropping them.
 *
 * This file is a thin adapter, not a reimplementation: `@openisd/model`'s
 * `openisdYamlToWdr(yamlText): Result<string>` (`{ value, errors }`) keeps that exact
 * TypeScript signature for its in-repo callers — see that file's own docstring for what it
 * composes. This bridge only renames `value` to `wdr` and serialises the pair to JSON at the
 * V8 boundary; the field-for-field shape of `errors` is passed through unchanged.
 */
import { parse, stringify } from 'yaml';
import { openisdYamlToWdr as projectOpenisdYamlToWdr, OpenISDDriver } from '@openisd/model';

function openisdYamlToWdrBridge(yamlText: string): string {
  const result = projectOpenisdYamlToWdr(yamlText);
  return JSON.stringify({ wdr: result.value, errors: result.errors });
}

/**
 * openisd.yml round trip: `{ ymlResult: string | null, errors: DriverError[] }` as a JSON
 * string. `ymlResult` is real YAML text, produced by running the input through the app's own
 * load/export chain and back out to YAML:
 *
 * 1. `parse()` (the `yaml` package) turns `yamlText` into a plain object.
 * 2. `OpenISDDriver.fromJsonRecord()` (`packages/model/src/openisdDriver.ts:291`) constructs a
 *    driver from that object — the same construction call the bundler
 *    (`scripts/bundle-drivers.mjs`) uses.
 * 3. `.toOwdrText()` (`openisdDriver.ts:534`) serialises the driver to `.owdr` JSON text — the
 *    same serialiser the app's real persistence save path uses
 *    (`packages/persistence/src/repos/projectRepo.ts:199`).
 * 4. `JSON.parse()` turns that JSON text back into a plain object.
 * 5. `stringify()` (the same `yaml` package, its serialise side) turns that object into YAML
 *    text — this is `ymlResult`.
 *
 * This function does not compare anything — no comparison logic lives here. The caller
 * (winisd_tools, in Python) holds the original record and compares it against `ymlResult` at
 * the data level (`yaml.safe_load()` on both sides), not byte-for-byte. Comments and original
 * formatting in `yamlText` are not preserved through this round trip — step 1→4 loses them by
 * parsing through JSON — and that's by design: the comparison this bridge feeds is data-level,
 * not byte-level.
 */
function roundTripOpenIsdYmlBridge(yamlText: string): string {
  let record: unknown;
  try {
    record = parse(yamlText, { logLevel: 'error' });
  } catch (e) {
    return JSON.stringify({
      ymlResult: null,
      errors: [{ level: 'error', field: 'yaml', message: `could not parse openisd.yml: ${String(e)}` }],
    });
  }
  if (record == null || typeof record !== 'object') {
    return JSON.stringify({
      ymlResult: null,
      errors: [{ level: 'error', field: 'yaml', message: 'openisd.yml did not parse to a record' }],
    });
  }
  try {
    const reserialised = OpenISDDriver.fromJsonRecord(record as never).toOwdrText();
    const ymlResult = stringify(JSON.parse(reserialised));
    return JSON.stringify({ ymlResult, errors: [] });
  } catch (e) {
    return JSON.stringify({
      ymlResult: null,
      errors: [{ level: 'error', field: 'specs', message: `openisd.yml record shape rejected: ${String(e)}` }],
    });
  }
}

/**
 * .wdr round trip: `{ reserialised: string | null, errors: DriverError[] }` as a JSON string.
 * `reserialised` is the `.wdr` text the app's own wdr reader (`OpenISDDriver.fromWdrText`,
 * `openisdDriver.ts:480`) and wdr export path (`.toWdrText()`, `openisdDriver.ts:509`) produce —
 * the same two calls the app's own import/export UI makes. The caller compares `reserialised`
 * against the bytes it just wrote, at the QT60 re-parse-equal bar (values + key order after
 * parsing), not byte-identity.
 */
function roundTripWdrBridge(wdrText: string): string {
  let driver: OpenISDDriver;
  try {
    driver = OpenISDDriver.fromWdrText(wdrText);
  } catch (e) {
    return JSON.stringify({
      reserialised: null,
      errors: [{ level: 'error', field: 'wdr', message: `could not read .wdr: ${String(e)}` }],
    });
  }
  const { value, errors } = driver.toWdrText();
  return JSON.stringify({ reserialised: value, errors });
}

declare global {
  var openisdYamlToWdr: typeof openisdYamlToWdrBridge;
  var roundTripOpenIsdYml: typeof roundTripOpenIsdYmlBridge;
  var roundTripWdr: typeof roundTripWdrBridge;
}

globalThis.openisdYamlToWdr = openisdYamlToWdrBridge;
globalThis.roundTripOpenIsdYml = roundTripOpenIsdYmlBridge;
globalThis.roundTripWdr = roundTripWdrBridge;
