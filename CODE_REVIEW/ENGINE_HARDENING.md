# Engine hardening — communicate failure, never emit silent `NaN`

**Status: partially implemented; the rest is specified below.** The
input-validation boundary (the _precondition_) now exists in `deriveDriver`,
which returns `{ value, errors }` and the UI renders those as per-chart messages
(`.gmsg`) and a dismissable issue list (`.drv-issues`). What remains is the
_postcondition_ — catching non-finite results the precondition can't foresee —
plus a few residual input guards. Items that change computed numbers stay
sign-off-gated under the calculation-stability rule.

Findings: `CODE_REVIEW.md` §11, §16-18, §20-21.

---

## The problem, in plain terms

The physics engine (`packages/engine/src/`) is made of **pure functions**: same
inputs → same outputs, no side effects. That is good. But pure does not mean
_safe_. Handed incomplete or degenerate data, a function keeps doing arithmetic
and produces `NaN` or `Infinity`.

### Why `NaN` is the worst possible way to fail

1. **Contagious.** Any arithmetic with `NaN` returns `NaN`; one bad value 20 steps
   back silently turns the whole SPL curve into nothing.
2. **Silent.** No error, no log. The graph just goes blank — you're left guessing
   which of a dozen inputs caused it.
3. **Breaks comparisons.** `NaN > 0`, `NaN < 0`, `NaN === NaN` are all `false`, so
   a guard like `if (excAt283 > 0)` silently takes the wrong branch.
4. **Fails far from the cause.** The blank graph is in the UI; the cause was a
   field parsed seconds earlier, three modules away.

Good failure is **near the cause, and named** — not a blank chart.

---

## The pattern the codebase uses: validate at the boundary, communicate with `Result`

The engine's error contract (`js-patterns.md`) is Go-style: the parse/derive
entry points return `Result<T> = { value: T | null, errors: DriverError[] }` with
levelled errors (`error` blocks; `warn` drops one reference line). The pure
calculation functions (`solve`, `sweep`, `maxCurves`) take an already-validated
`Driver` and stay clean and fast — they do **not** thread `Result` through the
per-frequency hot loop.

> Establish the invariant once, at the door. Then the hot path can trust it.

**No engine function throws.** (An earlier draft of this doc proposed
`throw EngineError`; that predates the `Result` adoption and is superseded —
`deriveDriver`/`parseWdr` return `{ value, errors }`, and failure is communicated
through that channel, not exceptions.)

### Layer 1 — precondition (implemented)

`deriveDriver` already validates inputs and returns errors instead of `NaN`:

- required `Fs > 0`, `Re > 0`, `Sd > 0`, `Vas > 0` → `error`
- at least two of `Qts/Qes/Qms` → `error`
- `Pe`/`Xmax` absent → `warn` (curve still drawn; one reference line dropped)

The UI shows `error`s as a per-chart block (`.gmsg`) and `warn`s as a dismissable
`.drv-issues` entry. This is finding §16 (Vas-without-Q → `NaN`) resolved.

### Layer 2 — postcondition (to implement)

A precondition on _inputs_ cannot prove a denominator never hits zero **mid-sweep**:
the solver's denominators are frequency-dependent intermediates computed ~400×
per redraw. A singularity or overflow can appear even with valid inputs (a
lossless system, parameters that happen to cancel, a grid point landing on a
pole). So add a second layer at the sweep boundary — communicated the same way,
via the `Result`/issue channel, **not** a throw.

**Where:** the store is the single enforced boundary between the raw engine and
the UI (ESLint forbids components importing `sweep`/`maxCurves` directly). The
store already unwraps `deriveDriver` and owns the issue channel, so the
finiteness classification lives there, keeping `sweep`/`maxCurves` plain. (If the
engine were ever published standalone, the same check would move inside `sweep`
returning `Result<SweepResult>`; for this app the store boundary is equivalent
and far less invasive.)

**Classification — partial vs pervasive (the key nuance):** a non-finite value at
_one_ frequency is almost always the grid unluckily landing on a pole — a
measure-zero numerical artifact, not a physical "no output". The renderer
(`canvas.ts drawOne`) already **breaks the line at non-finite points**, so a
partial curve draws itself. So:

| Situation                   | result                      | UI                                                                    |
| --------------------------- | --------------------------- | --------------------------------------------------------------------- |
| Some points non-finite      | keep the arrays (with gaps) | partial curve + `warn` naming the frequency ("undefined near ~47 Hz") |
| **No** finite points at all | treat as unusable           | no chart + `error` ("can't simulate — check box volume / parameters") |

Rule: **null/error only when the primary series has zero finite points; otherwise
show the partial data and attach a `warn`.** Never blank a chart that has drawable
data; never leave a gap unexplained. Do not interpolate across a gap — that
fabricates a value where the model is undefined.

`Number.isFinite()` catches both `NaN` and `±Infinity` in one check.

### The primitive ops (`cDiv`/`cInv`, finding §17)

Leave them branch-free for speed. A zero denominator there is only reachable if
one slips past the precondition; the postcondition is the net. (Optionally
assert-on-zero in dev builds only.)

---

## Residual input guards (small, additive)

- **§11 `Qms == Qts`** — `deriveDriver` derives `Qes = Qts·Qms/(Qms−Qts)`; if both
  are present and equal, that divides by zero → `Qes = Infinity`. Add a guard: when
  `Qts` and `Qms` are both given, require `Qms > Qts` (else an `error`). Input
  validation, not a formula change.
- **§18 `Vb ≤ 0`** — a zero/absent box volume makes `Cab = 0` → `cInv(0)` poisons
  the whole solve. Add `Vb > 0` (and `Vf > 0` for bandpass, `Sp > 0` for vented,
  PR params for `pr`) to the param precondition.

---

## Items that change numbers (separate approval)

Not robustness — they change computed output, so they need explicit sign-off:

- **§20 constants** — `C`/`RHO` are labelled 20 °C but are ~24 °C values. Decide a
  single reference temperature and correct either the values or the comment. Verify
  exact textbook figures first.

---

## Summary

- The engine is pure and correct — keep it that way.
- `NaN` is silent, contagious, and fails far from the cause: the worst failure mode
  for a tool whose job is trustworthy numbers.
- Precondition (implemented): validate inputs in `deriveDriver`, return `{value,
errors}`.
- Postcondition (to add): after the sweep, classify finiteness at the store
  boundary — partial curve + `warn` for isolated singularities, `error` only when
  nothing finite remains. No throwing.
- Number-changing items (temperature constants) stay sign-off-gated.

---

## TODO (merged from ENGINE_HARDENING_TODO.md, 2026-07-20)


**Priority: HIGH.** The engine can still emit `NaN`/`Infinity` on degenerate input
mid-sweep, producing a blank/garbage chart with no explanation. This undermines the
one thing the tool exists to do: produce trustworthy numbers.

Design + rationale: `CODE_REVIEW/ENGINE_HARDENING.md`. Findings:
`CODE_REVIEW/CODE_REVIEW.md` §11, §16-18, §20-21.

**Failure is communicated with the `Result` pattern, never by throwing** — the
engine's contract (`js-patterns.md`) is `{ value, errors }` with `error`/`warn`
levels. The two layers below both feed that one channel.

---

## To do

### Additive input guards (no formula change)

- [ ] **§11 `Qms == Qts`** — in `deriveDriver`, when both `Qts` and `Qms` are given,
      require `Qms > Qts` (else `error`); otherwise `Qes = Qts·Qms/(Qms−Qts)` → ∞.
- [ ] **§18 params** — add a param precondition: `Vb > 0`, plus `Vf > 0` (bandpass),
      `Sp > 0` (vented), PR params present (`pr`). Return an `error` when unmet.

### Finiteness postcondition (the main remaining piece)

- [ ] After `sweep`/`maxCurves`, classify the output at the **store boundary**
      (the single enforced engine→UI seam; keeps `sweep` plain):
  - **Some** points non-finite → keep the arrays (canvas already gaps them) + a
    `warn` naming the affected frequency.
  - **No** finite points → treat as unusable: `error`, no chart.
  - Rule: null/error only when the primary series has zero finite points.
- [ ] Feed both into the existing `.gmsg`/`.drv-issues` channel — no new UI plumbing,
      no `throw`, no interpolation across gaps.

### ⚠ Sign-off gated — changes computed numbers

- [ ] §20 `constants.ts` — `C=345.0`, `RHO=1.184` labelled 20 °C but are ~24 °C
      values. Pick one reference temperature; correct values or comment. Verify exact
      textbook figures (20 °C ≈ 343.2 m/s, ≈1.204 kg/m³) first.

### Maintainability (no behaviour change)

- [ ] §21 `driver.ts` — document or name the 48-char `ParState` magic string.

---

## Acceptance criteria

- [ ] A driver with `Vas`+`Qts` but no `Qms` → clear message, not a blank graph.
- [ ] `Vb = 0` → clear `error`, not `Infinity`-poisoned curves.
- [ ] An isolated mid-sweep singularity → the curve still draws with a gap + a `warn`
      naming the frequency; it is never silently blanked.
- [ ] No code path returns a non-finite value to a chart without a surfaced issue.
- [ ] All existing physics tests pass unchanged; math for valid inputs stays
      bit-identical (golden byte-identical).
- [ ] New tests cover each rejection/partial case with a human-readable scenario name.
