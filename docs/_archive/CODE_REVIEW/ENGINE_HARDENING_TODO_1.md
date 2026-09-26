# Engine hardening — the remaining work

Findings and their evidence: `CODE_REVIEW/CODE_REVIEW_1.md`.

## The contract every item below must honour

**Failure is communicated with the `Result` pattern, never by throwing.**
`Result<T> = { value: T | null, errors: DriverError[] }`, levels `error` (blocks; `value` is
`null`) and `warn` (`value` stands; one reference line is dropped). No engine function throws.
The pure hot-path functions — `solve`, `sweep`, `maxCurves` — take an already-validated
`Driver` and do not thread `Result` through the per-frequency loop.

**Two layers, one channel.**

- **Precondition** — `deriveDriver` (`packages/engine/src/driver.ts:100-160`) validates inputs
  and returns errors instead of `NaN`: `Fs`/`Re`/`Sd`/`Vas` > 0 and two of `Qts`/`Qes`/`Qms`
  are `error`; `Pe`/`Xmax` absent are `warn`.
- **Postcondition** — `classifyFinite` (`packages/engine/src/sweep.ts:227-247`) classifies the
  sweep's finiteness at the store boundary, because a precondition on inputs cannot foresee a
  frequency-dependent singularity in ~400 intermediate denominators per redraw.

**Partial vs pervasive — the classification rule.**

| situation              | result                    | UI                                          |
| ---------------------- | ------------------------- | ------------------------------------------- |
| some points non-finite | keep the arrays with gaps | partial curve + `warn` naming the frequency |
| every point non-finite | unusable                  | no chart + `error`                          |

Never blank a chart that has drawable data; never leave a gap unexplained; never interpolate
across a gap — that fabricates a value where the model is undefined. `Number.isFinite()`
catches `NaN` and `±Infinity` in one test. The renderer already breaks the line at non-finite
points (`packages/ui/src/utils/canvas.ts:155,164`), so a partial curve draws itself.

`cDiv`/`cInv` (`packages/engine/src/complex.ts:7-8`) stay branch-free. They are the hot path;
the two layers above are what keep a zero denominator from reaching them.

---

## P1 — a wrong answer is currently shown with no warning

### 1. Reject non-finite derived values inside `deriveDriver`

`solveConsistencyGroup` fills `Qes = Qts·Qms/(Qms−Qts)` with no guard
(`packages/engine/src/driver.ts:57-58`). `deriveDriver`'s guard
(`packages/engine/src/driver.ts:130-133`) tests `!(r.Qes > 0)`, which is `false` once the field
holds `Infinity`, so the guard cannot fire on the app's only derivation path — the ADT calls
`solveConsistencyGroup` first and passes the result in (`packages/winisd/src/driver.ts:374,391`).

Verified: `Driver.fromRaw({ …, Qts: 0.5, Qms: 0.5 })` → `errors: []`, `toDriver()` non-null,
`Qes = Infinity`, `Bl = 0`, sweep flat at `-200 dB`, `classifyFinite` → `null`.

Add a finiteness check over every derived T/S field after the consistency-group pass, filed
against the field that produced it. Do not restrict it to the Q chain: the same shape recurs
wherever `solveConsistencyGroup` divides (`Fs` from `Mms`·`Cms`, `Re` from `Qes`/`Bl`).

**Acceptance:** entering `Qts == Qms` (and `Qts == Qes`) through the Driver ADT returns a
blocking `error` naming the field, and `toDriver()` returns `null`. A test exercises the **ADT**
path, not only `deriveDriver` with raw input — `packages/engine/test/driver.test.ts:213-234`
already covers the raw path and passes while the defect is live. All 326 existing unit tests
stay green and the golden fixtures stay byte-identical.

### 2. Render the issue channel in the Original and Classic shells

`allIssues` (`packages/ui/src/store.ts:424`) is read only by `DriverPanel.vue:77,155,161`, which
is mounted only via `SidePanel.vue:9` from `ModernShell.vue:11,43`. The default shell is
`original` (`packages/ui/src/store.ts:92`, `packages/ui/src/skins.ts:27-31`) and contains no
issue rendering at all. Every `warn`, and every `classifyFinite`/`classifyFlatClamp` result,
is invisible there.

Either mount an issue surface in `OriginalShell.vue` and `ClassicShell.vue`, or pass
`allIssues` rather than `driverErrors` into `buildPlotData` at `GraphPanel.vue:34` so the
`.gmsg` block (`GraphPanel.vue:360-363`) carries sweep errors too. The second is smaller and
covers all three shells at once, but it puts `warn`s on the chart — decide whether `.gmsg`
renders only `error` (as now, `GraphPanel.vue:38,42`) and `warn`s need their own surface.

**Acceptance:** with the default skin loaded, setting `Vb = 0` shows a readable message naming
the problem; clearing `Pe` shows the dropped-thermal-line warning; force-flat hitting its boost
ceiling shows the clamp warning. Asserted by a browser test that runs against the default
shell (see item 5).

---

## P2 — a gap in the net

### 3. Extend the finiteness postcondition to `MaxCurvesResult`

`classifyFinite` reads only `SweepResult` arrays (`packages/engine/src/sweep.ts:228`).
`maxCurves` yields `vXmax = Infinity` with `Xmax` absent and `vPe = Infinity` with `Pe` absent
(`packages/engine/src/sweep.ts:207-208`); with both absent, `maxspl` and `maxpwr` are `Infinity`
at every frequency and nothing reports it. Verified on a driver with no `Pe` and no `Xmax`:
`maxspl[0..2] = [Infinity, Infinity, Infinity]`, `classifyFinite(sweep(...))` → `null`. The
Max-power axis is then `ymax = Infinity` (`packages/ui/src/utils/series.ts:187`).

**Acceptance:** a driver with neither `Pe` nor `Xmax` produces an issue on the same channel
explaining that the Max-SPL and Max-power charts have no limit to plot against, instead of two
`Infinity` series. The existing `peAbsent` flag (`packages/engine/src/sweep.ts:214`, consumed at
`packages/ui/src/utils/series.ts:176`) stays as the legend's own signal.

### 4. Add a named parameter precondition

Nothing validates the box parameters before the solve. `Cab = P.Vb/(ρc²)`
(`packages/engine/src/circuit.ts:144`, `:186`, `:188`) with `Vb` zero or absent gives
`cInv(cx(0,0))` = `Infinity`. `classifyFinite` does catch every degenerate case — verified for
`Vb = 0`, `Vb` absent, vented without `Sp`/`Leff`, `pr` without PR params, and `bandpass4`
without `Vf`, all returning the `error` level.

The value of the precondition is therefore not catching the failure — it is **naming the field**.
Require `Vb > 0` always, plus `Vf > 0` (bandpass4), `Sp > 0` (vented) and the PR parameters
(`pr`), and file the `error` against the parameter at fault.

**Acceptance:** `Vb = 0` reports an error naming the box volume; a vented design with no vent
area reports one naming the vent, not the box volume. The generic
"check the box volume and driver parameters" message remains only for a singularity no
precondition predicted.

### 5. Run the browser suite against the default shell

`playwright.config.js:17` sets `baseURL: 'http://localhost:4100'`, and
`packages/ui/src/store.ts:92` selects the `modern` skin on port 4100. Every browser test —
including all five in `packages/ui/test/driver-invalid.browser.spec.ts` — therefore exercises a
shell that is not the default. Its `Vb = 0` test (`:88-107`) asserts on `.drv-issues`, which
does not exist in the default shell.

**Acceptance:** the hardening assertions run against the `original` shell. Keep Modern coverage;
add the default, do not swap.

### 6. Extend the engine-boundary lint rule to every UI subtree

`eslint.config.js:117` scopes the rule to `packages/ui/src/components/**` and
`packages/ui/src/utils/**`. `composables/`, `directives/`, `fields/`, `model/`, `shells/` and
`winisd/` are unguarded. Proven by running the same import through both paths: under
`shells/` ESLint is silent; under `components/` it errors with `no-restricted-imports`.

**Acceptance:** `packages/ui/src/**` is covered with the two documented exemptions
(`selftest`, `store.ts`), and a probe import of `sweep` under `shells/` fails lint.

---

## P3 — the rules that are not gated

### 8. Gate the documentation rules

`AGENTS.md:93-102` bans history in `.md`. Live violations sit at `BACKLOG.md:129,131-143,152,154-156`,
`ARCHITECTURE.md:49`, `FEATURES.md:25,54,86`, `WINISD_SCHEMA.md:465`. No check exists —
`grep -rln "preserved for history\|link-check\|linkcheck\|no-history" scripts/` returns nothing,
and `scripts/hooks-local/pre-commit:14-18` skips every gate for a doc-only commit, which is
exactly the class of change that introduces these.

**Acceptance:** a no-history check and a markdown link-checker run on doc-only commits too, and
the tree is green against both.

---

## Whole-feature acceptance

- A driver with `Vas` + `Qts` but no second Q → a clear message, not a blank graph.
  _(Currently met: verified `errors` names the Q requirement and `toDriver()` returns `null`.)_
- `Qts == Qms` → a clear message, not a silent flat line. _(Item 1.)_
- `Vb = 0` → a clear error naming the box volume, in the default skin. _(Items 2, 4.)_
- An isolated mid-sweep singularity → the curve still draws with a gap plus a `warn` naming the
  frequency; never silently blanked. _(Engine side met by `classifyFinite`; UI side is item 2.)_
- No code path delivers a non-finite value to a chart without a surfaced issue. _(Items 1, 3.)_
- All physics tests pass unchanged and the goldens stay byte-identical.
- Every new test carries a human-readable scenario name describing the rejection or partial case.
