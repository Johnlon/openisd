# OpenISD — Code Review Findings

Full-codebase review covering JavaScript/Vue and repository
structure/documentation. Every correctness finding was verified against the
source before listing. Each finding states the exact file, the failure scenario,
and a preventative practice.

Finding numbers (`§N`) are **stable IDs** referenced by `VIBE_CODING.md`; they are
never reused or renumbered. A resolved finding is removed and its number left as a
gap. New findings take the next free number. Verify the two docs agree after any edit.

---

## Correctness bugs — JavaScript / Vue

### 11. `packages/engine/src/driver.ts:29-30` — division by zero deriving Qes/Qms

`r.Qes = (Qts*Qms)/(Qms - Qts)` and the Qms line divide by `(Qms − Qts)` /
`(Qes − Qts)`. An external file with `Qms == Qts` yields `Infinity`, poisoning
`Bl`/circuit math.

> ⚠ This is `packages/engine/src` calculation code — needs explicit human sign-off before
> change (calculation-stability rule). The fix is an input-validation guard, not
> a formula change.

**Preventative:** small-denominator guard before the divide.

---

## Structure & documentation

### 13. History-in-docs violations (the project's own hard rule)

`BACKLOG.md:43-50` ("preserved for history", struck-through text),
`BACKLOG.md:23-37` (`## Shipped ✓` closed `[x]` list), `WDR_SCHEMA.md:439`
("previously in this section"), `ARCHITECTURE.md:48` ("pre-Vite era no longer
applies"), `FEATURES.md` dated "as of mid-2025" snapshots.

**Preventative:** CI grep over `*.md` for
`preserved for history|~~|previously|as of <date>|^\s*- \[x\]` — fail the build.

### 15. Competing "canonical" / roadmap sources

`FEATURES.md:190` names `drivers/README.md` canonical while `WDR_SCHEMA.md:3` is the
real source of truth; `FEATURES.md`, `COMPARISON.md`, and `BACKLOG.md` all act as the
roadmap. 16 root `.md` files sit beside an empty `docs/` dir.

**Preventative:** one roadmap (`BACKLOG.md`), one canonical schema doc
(`WDR_SCHEMA.md`); other docs link rather than restate. Consolidate root docs into
`docs/` or remove the empty dir.

---

## Preventative measures — practices to adopt

Generalised rules worth adding to `CLAUDE.md`/CI:

1. **One source of truth per concern** — collapse duplicate modules and
   duplicate roadmap/canonical docs. (5, 15)
2. **Validation lives in the shared write path** — never per-caller; assert with
   a test.
3. **Never coerce a missing value into a control-flow bound** — absent ≠ 0/empty.
   (1)
   (6)
4. **Retry policy by status** — only skip `status == "ok"`. (7)
5. **Cache keys must include content identity** (hash/mtime), never just a
   filename. (8)
   (2, 3)
6. **Guard against missing optional fields and zero denominators** before
   arithmetic in `packages/engine/src`/`sweep`. (11)
7. **Stable entity ids** — derive from persisted data, never a module counter that
   resets.
8. **CI guards for doc rules** — no-history grep + markdown link-checker. (13, 14)

---

## Engine / calculation core (`packages/engine/src/`) — robustness

The math in `packages/engine/src/` is correct on inspection, pure, side-effect-free, and
deterministic (verified: no `console`/`fetch`/`localStorage`/`Date`/`Math.random`,
no module-level mutable state, no argument mutation — `deriveDriver` and
`maxCurves` defensively copy their inputs). **These are not "vibe-coded".** The one
systemic weakness is the absence of an input-validation boundary: the pure
functions trust their callers completely and emit `NaN`/`Infinity` instead of a
clear error when handed incomplete or degenerate data.

See `CODE_REVIEW/ENGINE_HARDENING.md` for the proposed fix (a boundary guard) and
an explanation of why that is better than returning `NaN`.

### 16. `parseWdr` — driver with `Vas` but no `Qes`/`Qms` derives `Bl`/`Rms` as `NaN` — ✓ RESOLVED (at parseWdr only)

**✓ RESOLVED at the file-import path (verified):** `parseWdr` now requires **two** of
{Qts, Qes, Qms} before accepting a driver (`packages/engine/src/driver.ts:91-93`:
`_qCount >= 2`), matching `deriveDriver`'s contract — so a `.wdr` with only `Qts`+`Vas`
is rejected with `'missing core T/S parameters'` instead of yielding `NaN`.
**⚠ Does not cover the live UI path:** the app computes `deriveDriver(state.driverRaw)`
directly (not via `parseWdr`), so incomplete input from the What-If/Define editors
still reaches `deriveDriver` unguarded — see **§22**.

_Original:_ `parseWdr` accepted a `Vas`-only driver whose `Qes`/`Qms` stayed
`undefined`, so `Rms`/`Bl` derived as `NaN` → blank graphs, no error.

**Preventative:** one validated definition of "complete driver" enforced at **every**
engine entry, not just `parseWdr` (see §22).

### 17. `complex.ts:5-6` — `cDiv`/`cInv` divide by `re²+im²` with no zero guard

Root enabler of every `NaN` above: a zero denominator yields `Infinity`/`NaN`
silently. (Keep the hot path branch-free; prevent zero denominators at the
boundary instead — see ENGINE_HARDENING.md.)

### 18. `circuit.ts:85,126,128` — `Cab = Vb/(ρc²)` with `Vb` 0/undefined → `cInv(0)` poison

A box volume of 0 or an unset `Vb` makes `Zc = cInv(cx(0, 0))` → `Infinity`/`NaN`
through the entire solve.

### 20. `constants.ts:11-12` — values labelled "20 °C" correspond to ~24 °C

`C = 345.0` m/s and `RHO = 1.184` kg/m³ are commented "20 °C", but textbook 20 °C
dry-air values are ≈343.2 m/s and ≈1.204 kg/m³ (345/1.184 ≈ 24 °C). A fixed ~1%
systematic offset on all volume/SPL/tuning math, with no user temperature input.
⚠ Affects computed output — sign-off gated; verify exact textbook values first.

### 21. `driver.ts` — opaque 48-char `ParState` magic string — ◐ DOCUMENTED

**◐ DOCUMENTED (verified):** the string is still hard-coded
(`packages/engine/src/driver.ts:113`) but now carries a comment explaining it is a
WinISD per-field edit-state flag sequence and mapping the positions to the WDR field
order (`:111-112`). The maintainability wart is annotated, not removed — a data-driven
builder driven by per-field state would eliminate the literal.

### Already listed above (engine-related)

- §11 `driver.ts:29-30` — division by zero when `Qms == Qts`. Still present.

---

## New findings — 2026-07-01 review

### 22. `store.js:56` — validation asymmetry: the live UI bypasses the `parseWdr` guard → `NaN` still reaches the UI

§16 hardened **`parseWdr`** (the `.wdr` file-import path) to require ≥2 of {Qts, Qes,
Qms}. But the app's live driver is `deriveDriver(state.driverRaw)`, computed **directly**
in `packages/ui/src/store.ts:56` — it never goes through `parseWdr`. `deriveDriver`
(`packages/engine/src/driver.ts:25-37`) has no validation boundary: given a driver with
only `Qts`+`Vas` (or `Qms == Qts`, or no `Re`), it returns `Bl`/`Rms`/`Cms` as `NaN`,
which `syncedP.eg = √(Pin·driver.Re)` (`store.js:73`) then spreads across the whole sweep
→ blank graphs, no error. Reachable from the What-If and Define-new editors, and from a
malformed `driverRaw` restored out of `localStorage`. So the §16 fix gives false comfort:
the file path is guarded, the interactive path is not.

**Failure scenario:** in the What-If editor, clear `Qes` and `Qms` leaving only `Qts`;
every graph goes blank with no message.

**Preventative:** put the boundary guard in `deriveDriver` (or a wrapper the store and
`parseWdr` both call) so **every** engine entry rejects incomplete input with a named
error — the single-definition fix §16's preventative already called for. See
`CODE_REVIEW/ENGINE_HARDENING.md`.

**Status:** fix in progress (engine input-validation boundary). Re-verify and mark
resolved once landed.
