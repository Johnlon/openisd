/**
 * V8-loadable entry point for the embedded-V8 boundary `winisd_tools` calls in-process
 * (winisd_tools/DESIGN.md §12.5/§12.6). Built into a single self-contained IIFE by
 * `npm run build:bridge` (packages/design/vite.bridge.config.ts →
 * packages/design/dist/openisd-bridge.js) and evaluated once per process inside a bare V8
 * context that has no `console`, `process`, `fetch`, `require` or module loader.
 *
 * `globalThis.openisdYamlToWdr` is the ONE global this file adds — the property mini-racer's
 * Python caller reads and calls (`ctx.call("openisdYamlToWdr", [yamlText])`). This is a
 * deliberate, spec-mandated exception to ARCHITECTURE.md §5 "NO GLOBAL VARIABLES": the whole
 * point of this file is to publish a symbol a foreign V8 embedding can find with no import
 * machinery of its own, matching the existing `window.selfTestDone` precedent (QT69.1: the
 * bridge exposes exactly one function).
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
 * The Python caller's entire job is: call this once per record, and treat any `errors` entry
 * with `level: 'error'` as `rebuild_error.alert`-worthy. No second call, no separate comparison
 * — the caller MUST NOT be asked to re-parse and diff anything itself (John, 2026-08-25). The
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
 */
import { openisdYamlToWdr as projectOpenisdYamlToWdr } from '@openisd/model';

function openisdYamlToWdrBridge(yamlText: string): string {
  const result = projectOpenisdYamlToWdr(yamlText);
  return JSON.stringify({ wdr: result.value, errors: result.errors });
}

declare global {
  var openisdYamlToWdr: typeof openisdYamlToWdrBridge;
}

globalThis.openisdYamlToWdr = openisdYamlToWdrBridge;
