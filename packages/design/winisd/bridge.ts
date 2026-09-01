/**
 * V8-loadable entry point for the embedded-V8 boundary `winisd_tools` calls in-process
 * (winisd_tools/DESIGN.md §12.5/§12.6). Built into a single self-contained IIFE by
 * `npm run build:bridge` (packages/winisd/vite.bridge.config.ts →
 * packages/winisd/dist/openisd-bridge.js) and evaluated once per process inside a bare V8
 * context that has no `console`, `process`, `fetch`, `require` or module loader.
 *
 * `globalThis.driverYmlToOpenisdAndWdr` is the ONE global this file adds — the property
 * mini-racer's Python caller reads and calls
 * (`ctx.call("driverYmlToOpenisdAndWdr", [driverYmlText])`). This is a deliberate,
 * spec-mandated exception to ARCHITECTURE.md §5 "NO GLOBAL VARIABLES": the whole point of this
 * file is to publish a symbol a foreign V8 embedding can find with no import machinery of its
 * own, matching the existing `window.selfTestDone` precedent (QT69.1: the bridge exposes
 * exactly one function).
 *
 * Contract (`drivers/drivers.md` Part C, approved by John 2026-08-30): the exposed function
 * takes `driverYmlText: string` — the SCRAPER's `driver.yml`, not `openisd.yml` — and returns a
 * JSON STRING, not an object, so the value crosses the mini-racer boundary with no structured
 * marshalling. Parsed, that string is
 * `{ openisd: string | null, wdr: string | null, errors: DriverError[] }`:
 *
 *   - `openisd` — the `openisd.yml` text, `driver.yml` minus its `scraper_meta` section, keys in
 *     `driver.yml`'s own order.
 *   - `wdr` — the `.wdr`/INI text, or `null` when a blocking error prevented projection.
 *   - `errors` — always an array (never null/undefined; empty means clean) of
 *     `{ level: 'error'|'warn', field: string, message: string }`. A successful projection can
 *     still carry `warn` entries, and the JSON envelope is what keeps those reaching the Python
 *     caller instead of a bare string silently dropping them.
 *
 * The Python caller's entire job is: call this once per record, write the two texts, and treat
 * any `errors` entry with `level: 'error'` as `rebuild_error.alert`-worthy. No second call, no
 * separate comparison — the caller MUST NOT be asked to re-parse and diff anything itself
 * (John, 2026-08-25).
 *
 * ⚠ THIS ENVELOPE MUST LAND WITH ITS PYTHON HALF. `winisd_tools`' `openisd_js.py` `_result_from`
 * asserts `set(envelope) == {"wdr","errors"}`; the third key raises `BridgeFault` on EVERY
 * record until that assertion and `WdrResult` are widened, and the call site is renamed from
 * `openisdYamlToWdr`. `drivers.md` Part D lists that side.
 *
 * This file is a thin adapter, not a reimplementation: the projection, its round-trip checks and
 * every `errors` entry come from `./driverYmlToOpenisdAndWdr.ts` — see that file's own
 * docstring. This bridge only serialises the result to JSON at the V8 boundary; the
 * field-for-field shape of `errors` is passed through unchanged.
 */
import { driverYmlToOpenisdAndWdr } from './driverYmlToOpenisdAndWdr.js';

function driverYmlToOpenisdAndWdrBridge(driverYmlText: string): string {
  const { openisd, wdr, errors } = driverYmlToOpenisdAndWdr(driverYmlText);
  return JSON.stringify({ openisd, wdr, errors });
}

declare global {
  var driverYmlToOpenisdAndWdr: typeof driverYmlToOpenisdAndWdrBridge;
}

globalThis.driverYmlToOpenisdAndWdr = driverYmlToOpenisdAndWdrBridge;
