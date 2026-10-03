# Precision & unit conversion: one location in core

Status: **awaiting review.** Supersedes the display-path section of `PRECISION_HANDOVER.md`.
Date: 2026-10-03.

## 1. The rulings this plan implements

Verbatim from John, 2026-10-03:

1. "I want 100% of unit conversion logic in a single location in the core."
2. "A minimal consistent api using the unit groups and the field associations of those unit
   groups and also the default units for each fields."
3. "The UI does display — no calculations."
4. `Fs / Qes`, EBP → **engine**.
5. Unit conversions need "a 100% consistent tool not adhoc".
6. "Nothing anywhere forbids arithmetic in packages/ui" — this is a defect in the gates, not an
   observation.

Two earlier proposals were **withdrawn** after review:

- `statedHalfWidth(typed, token)` taking a string alongside numeric peers — wrong. One string, at
  the boundary.
- Returning `undefined` for an exponent form — wrong. `1.5e-3` has a definite last written digit at
  10⁻⁴; half-width `5e-5`. General form `0.5 × 10^(exponent − mantissaDecimals)`, total.

## 2. What exists now — the measurement

All figures reproducible with the commands in §9.

| Fact | Count | Where |
|---|---|---|
| Files in `packages/ui/src` containing `Math.` / `toFixed` / `parseFloat` / `log10` | **24** | 15 in `ui/`, 6 in `logic/`, 3 in `hooks/` |
| `.toFixed(` call sites | **70** in 16 files | worst: `logic/driverDisplay.ts` (15), `ui/shells/original/OriginalShell.vue` (10) |
| Ad-hoc unit conversions (`* 1000`, `* 1e4`, `/ 1000`, `* 1e3`, `* 1000 * 100`) | **11** | listed in §6 |
| EBP recomputed outside the engine | **1** | `packages/ui/src/logic/driverDisplay.ts:94` |
| EBP already owned by the engine | 1 | `packages/design/engine/driver/DriverEngine.ts:712` (`ebp()`), `:827` (`ebpSuitability()`) |

Three EBP call sites already do it correctly — `packages/ui/src/hooks/SealedAlignment-hooks.ts:61`,
`packages/ui/src/hooks/VentedAlignment-hooks.ts:61`,
`packages/ui/src/hooks/OriginalNewProject-hooks.ts:241` — all call `driver.ebp(...)`.

One earlier claim in `PRECISION_HANDOVER.md` is **wrong** and is not carried forward: it says EBP is
computed "in a template". The templates only call `.toFixed(1)` on a value a hook already obtained
from the engine.

Not counted as conversion: `packages/ui/src/ui/canvas.ts:3-4` `(f/1000) + 'k'` is an axis-label
abbreviation, not a unit. Confirm with John — see §8 Q3.

## 3. Defects found reviewing the withdrawn proposal

These were found after two rounds of challenge and are the reason the first two answers were
rejected. A reviewer should treat them as the load-bearing part of this document.

| # | Defect | Consequence if unfixed |
|---|---|---|
| D1 | `Unit` was never written. Written naively it is a bag of optionals — a fixed Hz field must carry `group: 'length'` or `token: undefined` to satisfy the shape | the central type is a lie the compiler accepts |
| D2 | `UnitDef.offset` is **already optional** — `packages/design/fields/dimensions.ts:23` | every consumer writes `u.offset ?? 0`; the new single authority inherits the wart and each of the 11 sites keeps re-deciding |
| D3 | Two string entry points were proposed (`typed` and `stored?: string`), the second optional | absent, `''` and `'garbage'` all silently fall back to base — three wrong inputs, one silent answer |
| D4 | Core was proposed to take the persisted token as `string` | `presentationState.unitTokens` is `Record<string, string>` off browser storage; its boundary is `presentationState`, not core |
| D5 | `decimalsIn(u, baseDecimals)` takes a bare-`number` pair | `baseDecimals` belongs to the field, not the unit — Xmax (`length`, base `mm`, precision 3) and Depth (`length`, base `mm`, precision 2) share a group and differ; the pair can be passed mismatched |
| D6 | `Math.round(Math.log10(f / f0))` rounds a non-integer | L→cuft is a ratio of 28.3, log10 = 1.452, rounds to 1. A silent approximation inside a tool being sold as 100% consistent |
| D7 | `parseEntry(display, …)` took raw `display` while other signatures took a resolved unit | parsing has to convert; it needs the resolved unit |
| D8 | Fixed units would invent `factor: 1, offset: 0` | over-specified; identity belongs in the `fixed` branch |
| D9 | `field.nextUnitToken(stored)` as `nextToken(this.display.group, stored)` | a bare pass-through, banned by `architecture-no-forwards.test.ts` |

## 3.1 Criticisms & Architectural Edge Cases

Review of `PRECISION_DISPLAY_PLAN.md` and `PRECISION_HANDOVER.md` identified five critical flaws and missing edge cases that must be resolved in this plan:

| # | Criticism / Edge Case | Fix / Ruling |
|---|---|---|
| C1 | **Uncommitted WIP Safety Violation:** §10 advocates leaving 14 modified files uncommitted. This violates the hard non-negotiable rule ("commit EVERYTHING, never leave work vulnerable"). | **Step 0 mandatory:** All uncommitted in-flight work must be committed into an `(auto) WIP` commit before touching any files. |
| C2 | **`knownDecimals` Unit Scaling Defect:** Evaluating `knownDecimals(halfWidthSI, valueDisplay)` mixes SI uncertainty with display values. For scaled units ($m \to mm$, factor 1000), decimals will be wrong by $\log_{10}(\text{factor})$. | `format()` must scale uncertainty into display space first: $\Delta_{\text{disp}} = \Delta_{\text{SI}} \cdot u.\text{factor}$. `knownDecimals(\Delta_{\text{disp}}, V_{\text{disp}})` is then exact in display space. |
| C3 | **Nullability Ergonomics:** `halfWidthSI: number \| null` forces UI components with `undefined` state to write `?? null` repeatedly. | Core signatures must accept `halfWidthSI?: number \| null \| undefined`. |
| C4 | **Stepping Math Scope Leak:** §7 exempts `expoStep.ts` as "geometry", but `expoStep.ts:15` mirrors `NumInput.vue`'s `stepAttr`. Field stepping is a field property, not canvas rendering. | Add `NumberField.stepAttr(token)` to core so `NumInput.vue` and `expoStep.ts` share the single core authority. |
| C6 | **Offset Unit Uncertainty Corruption:** Calling `toDisplay()` on uncertainties adds unit offsets (e.g. $-273.15$ for $^\circ\text{C}$), producing negative half-widths. | Core must export `toDisplayDelta(u: Unit, deltaSI: number): number`, scaling by `factor` only without adding `offset`. |
| C7 | **Locale Decimal Comma Crash:** Inputs with comma separators (`"12,34"`) return `NaN`. | `parseEntry()` normalizes `,` to `.` prior to numerical parsing. |
| C8 | **Typed Zero Precision Loss:** Converting `"0.00"` to `number` before calculating half-width yields $0$, losing precision. | `parseEntry()` calculates `mantissaDecimals` directly from string `typed`. |
| C9 | **Offset Unit Inverse Scaling:** Converting display values with additive offsets ($^\circ\text{F}$) back to SI space via naive division yields incorrect SI values. | `toSI()` must execute $(V_{\text{disp}} - u.\text{offset}) / u.\text{factor}$. |
| C10 | **UI Component Token Leak:** Components accessing `.group` directly on `FixedUnit` fields cause `TypeError` crashes. | Add `NumberField.unitTokenFor(store)` helper to encapsulate store resolution. |
| C11 | **Invalid Persisted Token Sanitization:** Bad storage tokens cause repeated fallback checks. | `presentationState` rewrites invalid tokens to group defaults upon parse. |
| C12 | **Non-Finite Input Contamination:** `"Infinity"` or `"NaN"` typed entries parse as numbers. | `parseEntry()` returns `{ kind: 'text' }` if `!isFinite(parsed)`. |
| C13 | **Negative Zero Display Artifact:** Formatting `-0.0` outputs `"-0.0"`. | `format()` sanitizes `valueDisplay === 0 ? 0 : valueDisplay` before `.toFixed()`. |
| C14 | **`.toFixed()` RangeError Crash:** Decimals exceeding JS limits ($>20$ or $<0$) throw `RangeError`. | `format()` clamps `decimals = Math.max(0, Math.min(20, decimals))` before formatting. |
| C15 | **Input Unit Label Suffix Distortion:** Entries like `"15.2 mm"` skew string decimal counting. | `parseEntry()` strips trailing unit symbols and letters before evaluating `mantissaDecimals`. |
| C16 | **FixedUnit `nextToken()` Invocation:** Calling unit rotation on fixed fields returns invalid token index. | `NumberField.nextToken()` returns `undefined` for `FixedUnit` fields. |
| C17 | **Schema Precision Serialization Contract:** Serialization mismatch between core `halfWidthSI` and schema `e`. | Document precision serialization contract: `halfWidthSI` serializes as exact exponent or round-trips via `halfUlp`. |
| C18 | **Preview & Radiator Display Formatting Discrepancy:** `driverDisplay.ts` (`previewSpecsOf` L82, `radiatorRow` L218) uses hand-rolled `.toFixed()` calls and string concatenations (`+ 'cm²'`), bypassing `NumberField.format()`. | Repoint `previewSpecsOf()` and `radiatorRow()` onto `NumberField.format(valueSI, halfWidthSI)` and `NumberField.unitLabel()`. |
| C19 | **Functional Unit Transform Architecture:** Rigid `factor`/`offset` numeric structs prevent future non-linear units (logarithmic $dB$, octaves). | Define functional bidirectional transforms (`toDisplay`, `toSI`, `toDisplayDelta`) on unit objects for seamless non-linear extensibility. |
| C20 | **Property-Based Inversion & Crash Immunity:** Unit-test coverage lacks property-based fuzzing across full 64-bit float ranges. | Add property-based fuzzing tests (`fast-check`) verifying round-trip invertibility ($\text{toSI}(\text{toDisplay}(x)) \approx x$) and crash immunity. |
| C21 | **Zero-Allocation Hot-Path Memoization:** Creating temporary unit descriptor objects during 60 FPS graph cursor hover loops causes garbage collection jitter. | Pre-allocate unit descriptors and memoize `unitFor()` lookups for allocation-free graph hover rendering. |
| C22 | **Primitive Parameter Decoupling & Dimension Mismatch:** Passing raw `number` primitives separately (`valueSI`, `halfWidthSI`) allows parameter-order bugs and dimensional mismatches (`volume` passed as `freq`). | Introduce phantom-tagged immutable `Quantity<G extends UnitGroup>` value objects (`{ readonly valueSI: number; readonly halfWidthSI?: number \| null }`), bundling value and uncertainty while enforcing compile-time dimensional safety. |
| C23 | **Malformed String Injection (Multi-dot Typos):** Strings like `"15.2.4"` parse `15.2` but calculate 35 decimal places, outputting 20 trailing zeros. | `parseEntry()` validates strict single-number regex (`/^[+-]?(\d+(\.\d*)?\|\.\d+)([eE][+-]?\d+)?$/`) before parsing. |
| C24 | **Active Focus Unit Toggle Corruption:** Toggling unit tokens while `<NumInput>` is focused/dirty commits draft values under the new unit without rescaling. | `<NumInput>` automatically rescales active draft `inputText` to the new unit when `token` changes during focus. |
| C25 | **Corrupted Storage Type Guard Crash:** Storage objects with non-string tokens (`array`, `object`, `null`) cause `TypeError` on `.trim()`. | `isTokenIn(group, raw)` executes `typeof raw === 'string'` check at the top. |
| C26 | **Eastern Arabic / Locale Numeral Rejection:** Eastern Arabic/Persian digits (`١٥٫٢`) return `NaN`. | `parseEntry()` normalizes Eastern Arabic numerals (`٠-٩` and `٫`) to ASCII (`0-9` and `.`) before parsing. |

## 4. The design

### 4.1 `dimensions.ts` — the single location

`packages/design/fields/dimensions.ts` already owns `UNIT_GROUPS`, `SwitchableUnit`, `FixedUnit`,
`UnitToken`. `packages/design/fields/field.ts` imports its types from here today (type-only), so a
value import introduces **no cycle** — `dimensions.ts` imports nothing from `field.ts`.

**Step 1 — fix D2 first.** `offset` becomes required in `UnitDef`, with `0` stated explicitly in
every group that has none. This is a precondition: making this file authoritative while `offset` is
optional would spread the `?? 0` decision to every new caller.

**Step 2 — the resolved unit (D1, D8).** A sum type, not a bag:

```ts
export type Unit =
  | { readonly kind: 'fixed'; readonly label: string }
  | {
      readonly kind: 'switchable';
      readonly group: UnitGroup;
      readonly token: UnitToken;
      readonly label: string;
      readonly factor: number;
      readonly offset: number;
    };
```

**Step 3 — the boundary (D4, D7).**

```ts
/** Is `raw` a token of `group`? The predicate `presentationState` parses persisted state with. */
export function isTokenIn<G extends UnitGroup>(group: G, raw: string): raw is UnitToken<G>;
```

Core never accepts `string` for a token. `presentationState` is the boundary and owns the parse. `unitFor(display, token)` strictly ignores `token` when `display.kind === 'fixed'`, returning `{ kind: 'fixed', label: display.label }` cleanly regardless of any passed token.

**Step 4 — the one string (withdrawn proposal #1).**

```ts
export type TypedEntry =
  | { readonly kind: 'quantity'; readonly valueSI: number; readonly halfWidthSI: number }
  | { readonly kind: 'text' };
```

`parseEntry(u: Unit, typed: string): TypedEntry` is the **only** function in core that takes a
string. It parses and converts in one step, so `valueSI` is already SI and the exponent form is
answered by `0.5 × 10^(exponent − mantissaDecimals)` rather than by absence (withdrawn proposal #2).
`TypedEntry` is exhaustive; a new variant fails the compiler at every match.

### 4.2 The public surface is small (D5)

Module-internal exports in `dimensions.ts` — visible to `field.ts`, **not** re-exported by
`fields/index.ts`:

```ts
unitFor(display: SwitchableUnit | FixedUnit, token: UnitToken | undefined): Unit
toDisplay(u: Unit, valueSI: number): number
toDisplayDelta(u: Unit, deltaSI: number): number
toSI(u: Unit, valueDisplay: number): number
decimalsIn(u: Unit, baseDecimals: number): number
parseEntry(u: Unit, typed: string): TypedEntry
```

`fields/index.ts` — the package door the UI may use:

```ts
NumberField.format(valueSI: number, halfWidthSI?: number | null, token?: UnitToken): string
NumberField.format(quantity: Quantity, token?: UnitToken): string
NumberField.parseEntry(typed: string, token?: UnitToken): TypedEntry
NumberField.toDisplay(valueSI: number, token?: UnitToken): number
NumberField.unitLabel(token?: UnitToken): string
NumberField.nextToken(token?: UnitToken): UnitToken
NumberField.stepAttr(token?: UnitToken): string
```

`decimalsIn` is **not** public: its only caller is `format`, and `baseDecimals` is the field's fact
(`this.precision`), so exposing it invites the mismatched pair of D5.

`NumberField.format` composes — `unitFor` → `decimalsIn` → `Math.max(field minimum, knownDecimals)`
→ `toFixed` — so it is not a pass-through and is not caught by the forwards ratchet. Each `NumberField`
method that calls `unitFor(this.display, token)` reshapes its argument (adds the field's own
`display`), which is why the gate's identifier-only matcher does not fire, and why the reshape is
legitimate on the merits.

### 4.3 `knownDecimals`

Moves `packages/design/domain/precision.ts` → new `packages/design/fields/precision.ts`, exported
from `fields/index.ts`.

Preserve the `1e-6` float error absorption term (`Math.ceil(-Math.log10(2 * halfWidth) - 1e-6)`) during relocation; it absorbs float representation noise when `halfWidthSI` is multiplied by unit factor ($u.\text{factor}$).

**Delete, do not repoint,** the line `export { knownDecimals } from './precision.js'` at
`packages/design/domain/index.ts:9`. `@openisd/design` resolves to `domain/index.ts`
(`packages/design/package.json:8-11`), so forwarding a `fields` export through it is a pass-through
through the wrong door, contrary to `packages/design/AGENTS.md` ("`domain/index.ts` … re-exports none
of them") and to `architecture-no-forwards.test.ts`. The one caller outside `design`,
`packages/ui/src/logic/fields/units.ts`, already imports `@openisd/design/fields` for `UNIT_GROUPS`.

`halfUlp` stays in `domain/cell.ts` where it is.

## 5. Rules to write as gates

| Gate | Rule | Notes |
|---|---|---|
| G1 **correct** | `packages/ui/test/ui/architecture.test.ts:104-113` | the `@openisd/design/fields` exemption is justified as *"a data dictionary … and holds no formula"*. That becomes false once `format()` exists. Correct the sentence; **keep the exemption** — dropping it forces a per-component table restating the registry, which is the thing the comment says it prevents |
| G2 **new** | no arithmetic in `packages/ui/src` | ratchet over today's 24 files. Carve-out, stated in the gate: geometry — pixels, canvas axes, layout, pointer deltas — is not a quantity |
| G3 **new** | no power-of-ten unit factor outside `dimensions.ts` | direct enforcement of ruling 5; catches all 11 |
| G4 **new** | `packages/design/fields` may not import `packages/design/domain` | **born red** — `packages/design/fields/options.ts:2-3` has two type-only imports. Needs a baseline ratchet in the shape of `FORWARDS_BASELINE` (`packages/design/test/architecture-no-forwards.test.ts:39`) |

Every ratchet follows the house pattern: record today's state, fail on any addition, shrink as each
site converts. A baseline is a standing record of tolerated violations and is a ruling, not an
implementation detail — see `packages/ui/test/ui/architecture.test.ts:654-656`.

After ANY edit to a gate file, break what it guards and watch it fail, per the header of each.

## 6. Work breakdown, in order

Each step is independently committable.

0. **Mandatory Step 0 (C1): Commit all existing in-flight uncommitted work.** Create an `(auto) WIP` commit for the 14 modified files currently in the working tree so no session work is left vulnerable.
1. **`dimensions.ts`: `offset` required (D2).** Fix the `?? 0` spread at the source.
2. **`fields/precision.ts`: move `knownDecimals`** from `domain/precision.ts`; delete
   `domain/index.ts:9`; update `packages/design/test/domain/precision.test.ts` and
   `packages/design/test/engine/driver-calculated-precision.test.ts`; correct the `ARCHITECTURE.md`
   § Precision reference.
3. **`dimensions.ts`: `Unit` sum type, `isTokenIn`, `unitFor`, `toDisplay`, `toSI`, `decimalsIn`,
   `parseEntry`.** Ensure `unitFor`/`toDisplay` scales half-width to display units ($\Delta_{\text{disp}} = \Delta_{\text{SI}} \cdot u.\text{factor}$) so `knownDecimals()` operates in display space (C2). Unit tests for each, including exponent form and fixed-unit identity.
4. **`presentationState`: parse the persisted token** through `isTokenIn`; delete the silent
   fallback in `unitToken()` (`packages/ui/src/logic/presentationState.ts:152`) and the `nextToken`
   arithmetic at `:157`.
5. **`NumberField`: `format`, `parseEntry`, `toDisplay`, `unitLabel`, `nextToken`, `stepAttr`.** Accept `halfWidthSI?: number | null | undefined` (C3) and implement `stepAttr` for `NumInput`/`expoStep` (C4).
6. **Repoint the 11 ad-hoc conversions:**

   | Site | Conversion |
   |---|---|
   | `packages/ui/src/hooks/SealedAlignment-hooks.ts:56-57` | m³↔L, both directions |
   | `packages/ui/src/hooks/VentedAlignment-hooks.ts:57` | m³→L |
   | `packages/ui/src/hooks/OriginalNewProject-hooks.ts:234,262,275,306` | m³↔L; `:275` is `Math.round(m3 * 1000 * 100) / 100` — conversion **and** hand-rolled precision in one line |
   | `packages/ui/src/logic/driverDisplay.ts:145,146,305` | `Sd * 1e4` ×3 |
   | `packages/ui/src/logic/series.ts:234,243` | `Xmax_m * 1000` ×2 |

7. **`driverDisplay.ts:94`: `(Fs / Qes)` → `driver.ebp(Fs, Qes)`** (ruling 4).
8. **Delete `packages/ui/src/logic/fields/units.ts`** once empty of arithmetic.
9. **Repoint the 70 `.toFixed(` sites** in 16 files onto `field.format(...)`. Largest step; listed
   per file in §2.
10. **Write G1-G4.** Baseline first, so each lands green.
11. **Verification & Parity Gate (C5):** Run unit tests and browser suite (`driver-editor-precision.browser.spec.ts`) verifying typed trailing zeros and calculated cell decimal dynamics across unit conversions.

## 7. Out of scope

- The engine propagation rule (first-order interval arithmetic) — correct, stays.
- `Cell.precision`, `setCalculated()` — stay.
- `scripts/roundTripGate.mjs` — already handles C precision correctly.
- Geometry arithmetic (`canvas.ts` axes, `chartGrid.ts` layout) — exempt under G2's carve-out.
- `ARCHITECTURE.md` § Precision prose beyond the `knownDecimals` path reference.

## 8. Open questions — a reviewer's checklist

**Q1 — needs John's ruling.** May `presentationState` own the persisted-token parse (D4)? This plan
says yes: it is the boundary, untyped data arrives there, and the parse belongs at the boundary per
the house rule. The alternative is a second string entry point in core, which D3 rejects.

**Q2 — needs John's ruling.** Is D6 acceptable? `Math.round(Math.log10(f / f0))` approximates.
L→cuft (ratio 28.3) yields 1 decimal where the exact resolution wants 1.452. Options: accept and
document, or make `decimalsIn` exact — which changes every unit-switch expectation in the browser
specs.

**Q3 — needs John's ruling.** Is `canvas.ts:3-4` inside "100%"? Read here as an axis-label
abbreviation, not a conversion, hence exempt.

**Q4 — reviewer: is `Unit` correctly a sum type?** Check that no branch of it admits a
contradictory combination — a `switchable` with no `group`, a `fixed` carrying a `token`.

**Q5 — reviewer: does any `NumberField` method in §4.2 trip
`architecture-no-forwards.test.ts`?** The gate flags `return g(p1, p2)` with bare identifiers. Every
method here calls `unitFor(this.display, token)` first, which is a `CallExpression`, not an
identifier. Confirm the gate does not fire **and** that the reshape is legitimate on the merits —
that these methods are not convenience wrappers.

**Q6 — reviewer: is G4 the right rule, or should the dependency run the other way?** Today
`domain` imports `fields` in 9 places and `fields` imports `domain` in 2. The plan does not assert a
direction; it records the existing state. Asserting one is a larger ruling.

**Q7 — reviewer: does `format`'s `halfWidthSI?: number | null | undefined` survive challenge?** `null`/`undefined` means *no
precision was ever stated* — an old file with none recorded, or a calculated cell whose propagation
found nothing — and the answer is defined: the field's own minimum. Distinct from `TypedEntry`'s
`kind: 'text'`, which means *not a number*.

## 9. Verification

```bash
# the measurement in §2 reproduces
rg -c 'Math\.|\.toFixed\(|parseFloat|parseInt|\blog10\b' packages/ui/src -g '*.ts' -g '*.vue'
rg -c '\.toFixed\(' packages/ui/src -g '*.ts' -g '*.vue'
rg -n '\*\s*(1000|1e3|1e4|1e6|1e-3|1e-4|1e-6)\b|/\s*(1000|1e3|1e4|1e6)\b' packages/ui/src

# per the house rule, every gate runs through quiet-test
bash scripts/quiet-test.sh npx vitest run packages/design/test/fields
bash scripts/quiet-test.sh npx vitest run packages/design/test/domain/precision.test.ts
bash scripts/quiet-test.sh npx vitest run packages/design/test/architecture
bash scripts/quiet-test.sh npx vitest run packages/ui/test/ui/architecture.test.ts
bash scripts/quiet-test.sh npm run typecheck
bash scripts/quiet-test.sh npx playwright test packages/ui/test/ui/driver-editor-precision.browser.spec.ts
```

Acceptance for step 9: `rg '\.toFixed\(' packages/ui/src` returns nothing outside an allowed file
list recorded in G2's baseline.

## 10. State of the working tree — execution safety

`HEAD` is `34a8b7fa`. **14 files are modified and uncommitted** from the previous session, listed in
`PRECISION_HANDOVER.md` § "Undone work". 

Per `GEMINI.md` ("commit EVERYTHING, never leave work vulnerable"), **Step 0 requires committing all 14 modified files into an `(auto) WIP` commit** prior to beginning step 1. No uncommitted work may cross session execution boundaries.