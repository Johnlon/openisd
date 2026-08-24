/**
 * V8-loadable entry point for the embedded-V8 boundary `winisd_tools` calls in-process
 * (winisd_tools/DESIGN.md §12.5/§12.6). Built into a single self-contained IIFE by
 * `npm run build:bridge` (packages/winisd/vite.bridge.config.ts →
 * packages/winisd/dist/openisd-bridge.js) and evaluated once per process inside a bare V8
 * context that has no `console`, `process`, `fetch`, `require` or module loader.
 *
 * `globalThis.openisdYamlToWdr`, `globalThis.roundTripOpenIsdYml`,
 * `globalThis.roundTripOpenIsdYmlViaWdr` and `globalThis.roundTripWdr` are the FOUR globals this
 * file adds — the properties mini-racer's Python caller reads and calls
 * (`ctx.call("openisdYamlToWdr", [yamlText])`, and likewise for the other three). This is a
 * deliberate, spec-mandated exception to ARCHITECTURE.md §5 "NO GLOBAL VARIABLES": the whole
 * point of this file is to publish symbols a foreign V8 embedding can find with no import
 * machinery of its own, matching the existing `window.selfTestDone` precedent — named
 * exceptions, scoped to exactly this file, for exactly this reason. QT69.1 originally ruled the
 * bridge exposes exactly ONE function; John's later instruction (plan `shiny-noodling-kahan.md`
 * "Bridge round-trip API for the tools") supersedes it to add the round-trip pair, and a later
 * instruction still adds `roundTripOpenIsdYmlViaWdr` alongside them — record the amendments
 * against QT69 in the winisd_tools ledger when wiring the tools-side caller.
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
 * `openisdYamlToWdr` (`globalThis.openisdYamlToWdr`) IS THE ONE PRODUCTION CALL — the Python
 * caller's entire job is: call it once per record, and treat any `errors` entry with
 * `level: 'error'` as `rebuild_error.alert`-worthy. No second call, no separate comparison. The
 * self-validation that makes that possible — `yml-round-trip` and `wdr-round-trip` checks
 * folded into `errors` — is implemented entirely inside `@openisd/model`'s `openisdYamlToWdr`
 * (see that file's own docstring); this bridge function does not add anything of its own, it
 * only carries the already-validated result across the V8 boundary.
 *
 * This file is a thin adapter, not a reimplementation: `@openisd/model`'s
 * `openisdYamlToWdr(yamlText): Result<string>` (`{ value, errors }`) keeps that exact
 * TypeScript signature for its in-repo callers — see that file's own docstring for what it
 * composes. This bridge only renames `value` to `wdr` and serialises the pair to JSON at the
 * V8 boundary; the field-for-field shape of `errors` is passed through unchanged.
 *
 * The other three globals (`roundTripOpenIsdYml`, `roundTripOpenIsdYmlViaWdr`, `roundTripWdr`)
 * are lower-level primitives, not part of the production path: each exercises one
 * serialisation leg in isolation and returns its own re-serialised text with NO comparison
 * baked in, useful for `winisd_tools` diagnostics/tests that want to inspect an intermediate
 * result directly rather than only a pass/fail verdict. `openisdYamlToWdr` composes the same
 * underlying `OpenISDDriver` methods these three exercise individually; it does not call them.
 */
import { openisdYamlToWdr as projectOpenisdYamlToWdr, OpenISDDriver } from '@openisd/model';

function openisdYamlToWdrBridge(yamlText: string): string {
  const result = projectOpenisdYamlToWdr(yamlText);
  return JSON.stringify({ wdr: result.value, errors: result.errors });
}

/**
 * openisd.yml round trip — a LOWER-LEVEL PRIMITIVE, not the production path (see this file's
 * top docstring: `openisdYamlToWdr` runs this same `toOwdrJson -> fromOwdrJson -> toOwdrYml`
 * chain internally and folds its comparison into `errors` on every call; a caller wanting a
 * pass/fail verdict wants that function, not this one). `{ ymlResult: string | null, errors: DriverError[] }` as a JSON
 * string. `ymlResult` is real YAML text, produced by driving the input through all four of
 * `OpenISDDriver`'s Owdr construction/serialisation methods (`packages/model/src/openisdDriver.ts`)
 * in one chain, proving the whole set of serialisation surfaces survives together, not just the
 * yml pair:
 *
 * 1. `OpenISDDriver.fromOwdrYml(yamlText)` parses the YAML and constructs the first driver
 *    instance.
 * 2. `.toOwdrJson()` serialises that driver to `openisd.json` text.
 * 3. `OpenISDDriver.fromOwdrJson(jsonText)` parses the JSON and constructs a second, independent
 *    driver instance.
 * 4. `.toOwdrYml()` serialises that second driver back to YAML text — this is `ymlResult`.
 *
 * Every step is owned by the model itself, not assembled ad-hoc in this bridge — this function
 * is a thin adapter chaining the four. Applies uniformly to regular drivers and passive-radiator
 * records; PR-vs-not only matters later for whether a `.wdr` gets generated, which is unrelated
 * to this yml/json round trip.
 *
 * This function does not compare anything — no comparison logic lives here. The caller
 * (winisd_tools, in Python) holds the original record and compares it against `ymlResult` at
 * the data level (`yaml.safe_load()` on both sides), not byte-for-byte. Comments and original
 * formatting in `yamlText` are not preserved through this round trip — parsing to a plain
 * object and back loses them — and that's by design: the comparison this bridge feeds is
 * data-level, not byte-level.
 */
function roundTripOpenIsdYmlBridge(yamlText: string): string {
  try {
    const driver1 = OpenISDDriver.fromOwdrYml(yamlText);
    const jsonText = driver1.toOwdrJson();
    const driver2 = OpenISDDriver.fromOwdrJson(jsonText);
    const ymlResult = driver2.toOwdrYml();
    return JSON.stringify({ ymlResult, errors: [] });
  } catch (e) {
    return JSON.stringify({
      ymlResult: null,
      errors: [{ level: 'error', field: 'yaml', message: `openisd.yml could not be read: ${String(e)}` }],
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

/**
 * openisd.yml round trip VIA `.wdr` — a LOWER-LEVEL PRIMITIVE, not the production path (see
 * this file's top docstring: `openisdYamlToWdr` runs this same `toWdrText -> fromWdrText`
 * chain internally, as its `wdr-round-trip` check, and folds the comparison into `errors` on
 * every call; a caller wanting a pass/fail verdict wants that function, not this one — this one
 * exists for inspecting the intermediate `ymlResult` text directly). The same idea as
 * `roundTripOpenIsdYmlBridge` above, but driven all the way out through WinISD's own `.wdr`
 * format and back in, proving a driver survives the FULL projection surface the corpus
 * pipeline actually uses, not just the yml/json pair. `{ ymlResult: string | null, errors:
 * DriverError[] }` as a JSON string, same shape as `roundTripOpenIsdYmlBridge`.
 *
 * 1. `OpenISDDriver.fromOwdrYml(yamlText)` parses the YAML and constructs the first driver
 *    instance.
 * 2. `.toWdrText()` projects it to `.wdr`/INI text (`Result<string>` — `errors` from this step
 *    are folded into the returned `errors` array; a blocking failure here means no `.wdr` text
 *    exists to continue the chain with, so `ymlResult` is `null`).
 * 3. `OpenISDDriver.fromWdrText(wdrText)` re-reads that `.wdr` text and constructs a second,
 *    independent driver instance.
 * 4. `.toOwdrYml()` serialises that second driver back to YAML text — this is `ymlResult`.
 *
 * This function does not compare `ymlResult` against the original — no comparison logic lives
 * here, same as `roundTripOpenIsdYmlBridge`. The caller (winisd_tools, in Python) holds the
 * original record and compares it against `ymlResult`.
 *
 * ⚠️ THAT COMPARISON MUST NOT BE THE SAME STRICT DATA-EQUALITY BAR THE PURE YML↔YML ROUND TRIP
 * USES. `.wdr` is a minimal 49-slot numeric format
 * (`docs/plans/OPENISD_TARGET_MIGRATION_PLAN.md` Step 8) — going through it and back loses
 * everything the format was never designed to carry: `uuid`, `quality`, every field's
 * `origin`/`definition`/`dq`/`corroboration`/multi-source `readings`, `data_sources`,
 * `authoritative`, `product_image`, `description`, and any spec field outside
 * `@openisd/winisd`'s `INI_ROWS` (`freq_low_hz`, `freq_high_hz`, `power_peak_W`,
 * `voice_coil_dia_mm`, `weight_kg` confirmed lost against real fixtures below). `driver_type`
 * is always read back as plain `woofer` — `.wdr` carries no driver-type discriminator
 * (`OpenISDDriver.fromWinISDDriver`, `openisdDriver.ts`), so a passive-radiator or full-range
 * or tweeter record's specs land under `ymlResult`'s `specs.woofer` regardless of where they
 * started; `sku` is recomputed as a slug of the `.wdr` Brand/Model header text, which can
 * differ from the corpus's own slug convention. The `Comment` header field specifically is
 * additionally known lossy even on its own terms — `bugs/BUG_20260824_wdr_round_trip_always_loses_the_original_comment_field.md`
 * in `winisd_tools`: `toWinISDDriver()` writes `Comment=` from `description()` (derived from
 * the record), and `fromWinISDDriver()` never reads `Comment` back in at all.
 *
 * What DOES survive, confirmed against real corpus records (`grs/8fr-8`, `tang-band/pr01`) and
 * both `packages/winisd/test/fixtures/openisd/` samples: every `INI_ROWS`-tracked spec field
 * the original record STATED (`Provenance.Entered`) reads back with the exact same numeric
 * value, and `brand`/`model`/`manufacturer` header text round-trips unchanged. The caller's
 * comparison should be scoped to that — stated `INI_ROWS` field values match — not full-record
 * equality; anything else diverging here is the format doing what it always does, not a defect
 * this round trip introduced.
 */
function roundTripOpenIsdYmlViaWdrBridge(yamlText: string): string {
  try {
    const driver1 = OpenISDDriver.fromOwdrYml(yamlText);
    const { value: wdrText, errors: wdrErrors } = driver1.toWdrText();
    if (wdrText == null) {
      return JSON.stringify({ ymlResult: null, errors: wdrErrors });
    }
    const driver2 = OpenISDDriver.fromWdrText(wdrText);
    const ymlResult = driver2.toOwdrYml();
    return JSON.stringify({ ymlResult, errors: wdrErrors });
  } catch (e) {
    return JSON.stringify({
      ymlResult: null,
      errors: [{ level: 'error', field: 'yaml', message: `openisd.yml-via-wdr round trip could not be read: ${String(e)}` }],
    });
  }
}

declare global {
  var openisdYamlToWdr: typeof openisdYamlToWdrBridge;
  var roundTripOpenIsdYml: typeof roundTripOpenIsdYmlBridge;
  var roundTripOpenIsdYmlViaWdr: typeof roundTripOpenIsdYmlViaWdrBridge;
  var roundTripWdr: typeof roundTripWdrBridge;
}

globalThis.openisdYamlToWdr = openisdYamlToWdrBridge;
globalThis.roundTripOpenIsdYml = roundTripOpenIsdYmlBridge;
globalThis.roundTripOpenIsdYmlViaWdr = roundTripOpenIsdYmlViaWdrBridge;
globalThis.roundTripWdr = roundTripWdrBridge;
