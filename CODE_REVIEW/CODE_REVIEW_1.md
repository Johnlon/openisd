# OpenISD — Code Review Findings

Every finding below was re-verified against the working tree on 2026-08-05. Each states
the code site, the failure it produces, and the evidence that establishes it is live.

Finding numbers (`§N`) are **stable IDs** referenced by `VIBE_CODING.md`; they are never
reused or renumbered. A resolved finding is deleted and its number left as a gap. New
findings take the next free number. Verify the two docs agree after any edit.

Actionable work derived from these findings: `CODE_REVIEW/ENGINE_HARDENING_TODO_1.md`.

---

## Engine — correctness

### 11. Equal Q values divide by zero and escape the `deriveDriver` guard on the app's live path

`solveConsistencyGroup` derives the third Q by dividing by a difference
(`packages/engine/src/driver.ts:57-58`):

    if (r.Qes == null && r.Qts != null && r.Qms != null) r.Qes = r.Qts * r.Qms / (r.Qms - r.Qts);
    if (r.Qms == null && r.Qts != null && r.Qes != null) r.Qms = r.Qts * r.Qes / (r.Qes - r.Qts);

`deriveDriver` guards this at `packages/engine/src/driver.ts:130-133`, but the guard's first
clause is `!(r.Qes > 0)` — it only fires while the field is still absent or negative.
`Infinity > 0` is `true`, so an already-derived `Infinity` passes.

The app never calls `deriveDriver` on raw input. The Driver ADT runs
`solveConsistencyGroup(entered)` first (`packages/winisd/src/driver.ts:374`) and hands the
**result** to `deriveDriver` (`packages/winisd/src/driver.ts:391`), by which point `Qes` is
already `Infinity` and the guard is dead. The `qCount` completeness check
(`packages/engine/src/driver.ts:123`) also counts `Infinity` as a present Q.

**Evidence.** `Driver.fromRaw({ Fs:37, Vas:0.03, Sd:0.0133, Re:5.6, Xmax:0.005, Pe:60, Qts:0.5, Qms:0.5 })`:

    errors: []            toDriver() non-null      Qes = Infinity      Bl = 0
    sweep(...)            spl = -200 at every frequency
    classifyFinite(sw)    null

`Bl = √(2π·Fs·Mms·Re / Infinity) = 0` collapses the pressure source `pg`
(`packages/engine/src/circuit.ts:130`) to zero, so every SPL point takes the finite `-200 dB`
silence sentinel (`packages/engine/src/sweep.ts:121`). Nothing is non-finite, so the
postcondition sees a clean sweep. The result is a flat dead line with no message.

The **inverted** case is correctly rejected — `Qms < Qts` yields a negative quotient, `!(r.Qes > 0)`
holds, and the guard fires (verified: `Qts:0.6, Qms:0.4` → `error` on `Qms`, `toDriver()` null).
Only the **equal** case escapes.

`packages/engine/test/driver.test.ts:213-234` covers all three cases against `deriveDriver`
directly and passes, because it passes raw input in which `Qes` is genuinely absent. No test
exercises the ADT path, which is the only path the UI uses.

Reachable from the What-If editor, the Define-new editor, and any `.wdr` or project JSON
carrying `Qts == Qms`.

### 17. `cDiv`/`cInv` divide by `re²+im²` with no zero guard

`packages/engine/src/complex.ts:7-8`. A zero denominator yields `Infinity`/`NaN` silently.

**Kept deliberately branch-free** — these run ~400× per redraw per element. The design
position is that zero denominators are prevented at the input boundary and caught at the
sweep boundary. That position holds only as far as the net reaches; see §11, §18 and §25
for where it does not.

### 18. No `Vb > 0` precondition — the poison is caught at the exit, not the entry

`Cab = P.Vb / (ρc²)` (`packages/engine/src/circuit.ts:144`, and `:186`, `:188` for bandpass)
with `Vb` zero or absent gives `Cab = 0`, so `Zc = cInv(cx(0, 0))` is `Infinity`. Nothing
validates `Vb`, `Vf`, `Sp` or the PR parameters before the solve.

**Evidence — the postcondition does catch every one of them.** Sweeping a valid driver with
each degenerate parameter set and calling `classifyFinite`:

| box         | missing/zero param | `classifyFinite` verdict                          |
| ----------- | ------------------ | ------------------------------------------------- |
| `sealed`    | `Vb = 0`           | `error` — "Simulation produced no usable values…" |
| `sealed`    | `Vb` absent        | `error`                                           |
| `vented`    | `Sp`/`Leff` absent | `error`                                           |
| `pr`        | PR params absent   | `error`                                           |
| `bandpass4` | `Vf` absent        | `error`                                           |

So the symptom is contained. What is missing is the _named_ diagnosis: every case collapses to
one generic message that names the box volume regardless of which parameter is actually at
fault, and the error arrives one layer later than the field the user just edited.

### 25. The finiteness postcondition does not inspect `MaxCurvesResult`

`classifyFinite` reads only `SweepResult` arrays (`packages/engine/src/sweep.ts:228`).
`maxCurves` computes `vXmax = Infinity` when `Xmax` is absent and `vPe = Infinity` when `Pe`
is absent (`packages/engine/src/sweep.ts:207-208`), so with both absent every element of
`maxspl` and `maxpwr` is `Infinity`.

**Evidence.** `deriveDriver({ Fs:37, Qes:0.40, Qms:7.0, Vas:0.03, Sd:0.0133, Re:5.6 })` (no `Pe`,
no `Xmax`) → `warn:Pe`, `warn:Xmax`, driver valid. Then:

    maxCurves(...)  maxspl[0..2] = [Infinity, Infinity, Infinity]
                    maxpwr[0..2] = [Infinity, Infinity, Infinity]
    classifyFinite(sweep(...))  →  null

`seriesFor` scales the Max-power axis with `ymax = Math.max(...mx.maxpwr) * 1.2`
(`packages/ui/src/utils/series.ts:187`), which is then `Infinity`. The Max-SPL and Max-power
charts are unusable and the only signal is two driver-level `warn`s — which §23 shows are
invisible in the default skin.

---

## Engine → UI boundary

### 23. The issue channel has no consumer in the default skin

`allIssues` (`packages/ui/src/store.ts:424`) is the union of driver-derivation issues and
sweep issues. Its **only** consumer is `DriverPanel.vue:77,155,161`. `DriverPanel` is mounted
only through `SidePanel.vue:9`, and `SidePanel` is imported only by
`packages/ui/src/shells/modern/ModernShell.vue:11,43`.

`resolveSkin` returns `'original'` for everything except an explicit `classic`/`modern`
(`packages/ui/src/skins.ts:27-31`), and the persisted default is `'original'`
(`packages/ui/src/store.ts:92`). Neither `OriginalShell.vue` nor `ClassicShell.vue` contains
any string matching `issue` or `warn` — grep returns zero lines in both.

The three shells all render the shared `GraphPanel`
(`OriginalShell.vue:793`, `ClassicShell.vue:227`, via `ModernShell`), whose `.gmsg` block
(`GraphPanel.vue:360-363`) does show blocking driver errors. But `.gmsg` is fed from
`buildPlotData(..., driverErrors.value, ...)` (`GraphPanel.vue:34`) — `driverErrors`, not
`allIssues`. So in the default skin:

| issue class                                       | surfaced?               |
| ------------------------------------------------- | ----------------------- |
| driver `error` (Fs/Re/Sd/Vas/Q missing)           | yes — `.gmsg` per chart |
| driver `warn` (Pe/Xmax absent)                    | **no**                  |
| `classifyFinite` `error` (`Vb = 0`)               | **no**                  |
| `classifyFinite` `warn` (isolated singularity)    | **no**                  |
| `classifyFlatClamp` `warn` (force-flat truncated) | **no**                  |

`Vb = 0` in the Original skin therefore draws a flat `-200 dB` SPL line and a blank Excursion
chart with no explanation anywhere on screen — the exact failure the postcondition was built
to remove.

### 26. The enforced engine boundary covers two of eight UI subtrees

`eslint.config.js:117` scopes `no-restricted-imports` on `deriveDriver`/`sweep`/`maxCurves` to:

    files: ['packages/ui/src/components/**', 'packages/ui/src/utils/**']

`packages/ui/src/` also contains `composables/`, `directives/`, `fields/`, `model/`, `shells/`
and `winisd/`. None is covered.

**Evidence — run directly, same import, two paths:**

    $ echo "import { sweep } from '@openisd/engine'; export const x = sweep;" \
        | npx eslint --stdin --stdin-filename packages/ui/src/shells/original/__probe.ts
    (no output — clean)

    $ echo "import { sweep } from '@openisd/engine'; export const x = sweep;" \
        | npx eslint --stdin --stdin-filename packages/ui/src/components/__probe.ts
      1:10  error  'sweep' import from '@openisd/engine' is restricted …  no-restricted-imports

The shells are the largest UI subtree and the one that renders the default skin. Nothing stops
one bypassing the store's issue handling.

---

## Tests

### 24. Every browser test of the issue surface runs against a shell the user does not get

`playwright.config.js:17` sets `baseURL: 'http://localhost:4100'` and its `webServer` starts the
dev server on 4100. `packages/ui/src/store.ts:92` selects the skin by port:

    skin: (typeof window !== 'undefined' && window.location.port === '4100') ? 'modern' : 'original'

So the whole Playwright suite exercises **only** the Modern shell. All five tests in
`packages/ui/test/driver-invalid.browser.spec.ts` assert on `#ggrid .gpanel` and `.drv-issues`,
both Modern-only DOM. The `Vb = 0` test (`:88-107`) asserts `.drv-issues` is visible and carries
`is-error` — true in Modern, and §23 shows it is unreachable in the default shell.

The unit suite is green: `npm run test:unit` → 34 files, 326 tests, 0 failures. It contains no
test of the ADT derivation path's Q handling (§11) and none of the shells' issue rendering.

---

## Documentation & structure

### 13. History written into documentation, against the project's own hard rule

`AGENTS.md:93-102` bans history in any `.md` except `LOG.md`. Live violations:

| site                   | text                                                       |
| ---------------------- | ---------------------------------------------------------- |
| `BACKLOG.md:129`       | `## Shipped ✓` heading                                     |
| `BACKLOG.md:131-143`   | thirteen closed `- [x]` rows under it                      |
| `BACKLOG.md:152`       | "The description below is preserved for history."          |
| `BACKLOG.md:154-156`   | struck-through `~~…~~` block                               |
| `ARCHITECTURE.md:49`   | "constraint from the pre-Vite era no longer applies"       |
| `FEATURES.md:25,54,86` | "as of mid-2025", "as of the survey date" ×2               |
| `WDR_SCHEMA.md:465`    | "Supersedes the inferred table previously in this section" |

### 15. Documentation sprawl

`ls -1 *.md | wc -l` → **27** files at the repo root. `docs/` holds one document
(`DRIVER_ADT_DESIGN.md`), two images and two subdirectories, so the root is not being used as
overflow from a full `docs/` — the two are simply unpartitioned.

Six of the root files are plans (`PLAN.md`, `PLAN_DRIVER_ADT.md`,
`PLAN_JS_CALC_CONSOLIDATION.md`, `PLAN_SBL_CROSSCHECK.md`, `MATH_MIGRATION.md`, `WIP.md`) and
three act as roadmap (`BACKLOG.md`, `FEATURES.md`, `WINISD_OPENISD_COMPARISON.md`). There is no
stated rule for which of the three a new item goes in.

### 27. No mechanical guard for any documentation rule

`scripts/health-check.sh:33-36` runs ESLint, typecheck, unit and browser tests.
`scripts/hooks-local/pre-commit` runs lint + typecheck + unit and **skips all of them** for a
doc-only commit (`:14-18`). `scripts/hooks-local/pre-push` runs `npm run ci`, which is
`lint && typecheck && test` (`package.json:17`).

`grep -rln "preserved for history\|link-check\|linkcheck\|no-history" scripts/` returns nothing.
So §13's history violations, and broken cross-references generally, are in exactly the class of
change that every gate is configured to skip.

---

## Practices to hold

1. **Validate at the boundary, communicate with `Result`.** The engine's contract is
   `{ value: T | null, errors: DriverError[] }` with `error`/`warn` levels. No engine function
   throws. Failure travels on that channel or it is not communicated.
2. **A guard must be reachable from the path the app actually uses.** §11 is a guard that is
   correct, tested, and dead in production because a caller normalises its input first.
3. **A computed with no consumer is inert.** §23 is a fully implemented postcondition wired to a
   store export that no default-skin component reads.
4. **A test that runs against a non-default configuration proves nothing about the default.**
   §24.
5. **Never coerce a missing value into a control-flow bound** — absent ≠ 0 ≠ `Infinity`.
6. **A rule with no gate is a suggestion.** §27.
