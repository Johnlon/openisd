# TODO — Engine hardening

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
