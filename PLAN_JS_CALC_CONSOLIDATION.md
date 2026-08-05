# JS calc consolidation & CNE provenance — architecture change

Companion to [TODO.md QT39](http://localhost:8000/winisd/winisd_tools/TODO.md#L2405-L2447) (the
human ruling this document implements) · [BACKLOG.md](http://localhost:8000/winisd/openisd/BACKLOG.md#L25-L43)
("Next — do first" item 1, the WDR-generation half of the same ruling) ·
[BUG_20260731](http://localhost:8000/winisd/winisd_tools/bugs/BUG_20260731_the-same-ts-formulas-are-implemented-in-both-python-and-typescript.md#L1)
(what prompted it) · [ARCHITECTURE.md AD-6](http://localhost:8000/winisd/openisd/ARCHITECTURE.md#L314-L328)
(the layering this plan must respect) · [docs/DRIVER_ADT_DESIGN.md](http://localhost:8000/winisd/openisd/docs/DRIVER_ADT_DESIGN.md#L1)
(the E/C/N mechanism this plan extends, not replaces).

**Status:** TODO.md QT39 records "another agent is investigating… implementation waits on the
other agent's investigation." This document is that investigation. `winisd_tools` continues to
wait — nothing here authorizes writing to that repo yet.

---

## 1. Proof discipline used throughout this document

Every claim below of the form "this is genuine WinISD behaviour" or "this is not" carries a
**Proof** line stating the exact repeatable test — a file+line you can open, a command you can
re-run, or an empirical probe file you can re-derive from. Where no such proof exists, the row
says so explicitly rather than being marked ✅/❌.

---

## 2. The blessed goal: WinISD's own consistency groups

**Ruling applied:** anything proven to be genuine WinISD behaviour is a goal for OpenISD, full
stop — not a judgment call per formula.

[WDR_SCHEMA.md §4](http://localhost:8000/winisd/openisd/WDR_SCHEMA.md#L248-L271) already
enumerates WinISD's complete internal dependency graph as 22 consistency groups. **Proof of
their genuineness:** 15 of the 22 are extracted directly from ASCII strings inside `winisd.exe`
itself at offset ~8894, immediately preceding the `TfrmParErrors` form definition — reproduce by
running `strings winisd.exe` and locating that region
([WDR_SCHEMA.md:232-234](http://localhost:8000/winisd/openisd/WDR_SCHEMA.md#L232-L234)). The
remaining 7 are inferred from WinISD's dependency structure and observed behaviour; only group 18
is flagged uncertain. This table adds the Xmax group (19) proof found this session and marks
current implementation status on both sides:

| # | Fields | Formula | Proof this is genuine WinISD | Python (`model_wdr.py`) | TS — live path (`winisd/driver.ts`) | TS — engine (`engine/driver.ts`) |
|---|---|---|---|---|---|---|
| 1 | Rms, Fs, Cms, Qms | `Rms = 2π·Fs·Mms/Qms` | Binary string, group confirmed | not derived, range-checked only | [`:377`](http://localhost:8000/winisd/openisd/packages/winisd/src/driver.ts#L377) — guarded (`== null`) | [`:81`](http://localhost:8000/winisd/openisd/packages/engine/src/driver.ts#L81) — unconditional, dead path (see §4) |
| 2 | BL, Fs, Mms, Re, Qes | `Qes = 2π·Fs·Mms·Re/BL²` | Binary string | not derived | not derived (only Bl forward-derived, not this inverse) | not derived |
| 3–4 | Rme | `Rme = BL²/Re`, alt `2π·Fs·Mms/Qes` | Binary string | DQ-tolerance check only ([`:462`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L462-L463)) | not derived | not derived |
| 5 | Qts, Qms, Qes | `Qts = Qms·Qes/(Qms+Qes)` | Binary string; empirically re-verified [WDR_SCHEMA §5.1](http://localhost:8000/winisd/openisd/WDR_SCHEMA.md#L275-L302), reproduce via `drivers/sample/inconsistency-test-saved-q.wdr` | DQ-tolerance check ([`:454-455`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L454-L455)) | guarded ([`:369-371`](http://localhost:8000/winisd/openisd/packages/winisd/src/driver.ts#L369-L371)) | guarded ([`:73-75`](http://localhost:8000/winisd/openisd/packages/engine/src/driver.ts#L73-L75)) |
| 6 | Dd, Sd | `Dd = 2√(Sd/π)` | Binary string | **3 sites**: [`:374`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L374), [`:459`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L459), [`:487`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L487) | not derived (uses `Dia` name, not wired) | [`:42`](http://localhost:8000/winisd/openisd/packages/engine/src/driver.ts#L42), also `winisd/driver.ts:367` as `Dia` |
| 12 | EBP, Fs, Qes | `EBP = Fs/Qes` | Binary string | **3 sites**: [`:375`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L375), [`:461`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L461), [`:488`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L488) | not derived | canonical fn exists, unused: [`engine/alignments.ts:40`](http://localhost:8000/winisd/openisd/packages/engine/src/alignments.ts#L40); duplicated again at `useDriverLibrary.ts:448,492` |
| 13 | gamma, BL, Mms | `gamma = BL/Mms` | Binary string | DQ-tolerance check ([`:466-467`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L466-L467)) | not derived | not derived |
| 14 | no, c, Fs, Qes, Vas | `η₀ = (4π²/c³)·Fs³·Vas/Qes` | Binary string | different formula shape, DQ-check only ([`:470-472`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L470-L472), uses Mms/BL² route instead) | [`:381-382`](http://localhost:8000/winisd/openisd/packages/winisd/src/driver.ts#L381-L382) — **matches group 14 exactly** | [`:90`](http://localhost:8000/winisd/openisd/packages/engine/src/driver.ts#L90) — different constant form (`9.64e-10`), dead path |
| 16–17 | SPLmax, USPL | `SPL+10log(Pe)`, `SPL+10log(8/Re)` | Binary string | not derived | not derived | [`:92-94`](http://localhost:8000/winisd/openisd/packages/engine/src/driver.ts#L92-L94), dead path |
| 18 | SPL from no | `10log(η₀)+10log(ρ₀c²/2π)+109` | **⚠ inferred, not binary-confirmed** | n/a | [`:383`](http://localhost:8000/winisd/openisd/packages/winisd/src/driver.ts#L383) uses constant `112.1`, **not the derived ≈109** | [`:91`](http://localhost:8000/winisd/openisd/packages/engine/src/driver.ts#L91) uses constant `112.2` — a **third** value |
| 19 | Xmax, Hc, Hg | `Xmax = abs(Hc−Hg)/2` | **Verbatim WinISD help text**, [thielesmall.html](http://localhost:8000/winisd/openisd/research/winisd/help/thielesmall.html#L180-L182): *"usually calculated as abs(Hc-Hg)/2 … WinISD does not multiply with any of these factors"* | not derived (stores `missing:Xmax`) | **not wired** — `deriveDriver`'s `.value` (which contains it) is discarded, only `.errors` used ([`:393`](http://localhost:8000/winisd/openisd/packages/winisd/src/driver.ts#L393)) | present, now cited ([`:84-91`](http://localhost:8000/winisd/openisd/packages/engine/src/driver.ts#L84-L91)) but orphaned |
| 20 | Vd, Sd, Xmax | `Vd = Sd·Xmax` | Binary string | **3 sites**, m³, SI-correct: [`:370`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L370), [`:457`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L457), [`:486`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L486) | [`:380`](http://localhost:8000/winisd/openisd/packages/winisd/src/driver.ts#L380) — m³, SI-correct | [`:98`](http://localhost:8000/winisd/openisd/packages/engine/src/driver.ts#L98) — **cm³ (`*1e6`), the SI violation**, dead path |
| 21–22 | Gloss, SPLmaxLF | formula unknown | Not fully known even to this project | not derived | not derived | not derived |

**Row-18/19 finding, stated plainly:** the codebase currently contains **three different
constants** for the SPL-from-efficiency step (WDR_SCHEMA's inferred ≈109, `winisd/driver.ts`'s
`112.1`, `engine/driver.ts`'s `112.2`), and the live path (`winisd/driver.ts`) is the one that
does **not** match the only sourced derivation. This needs a dedicated formula audit before
Phase 1 below starts — treat it as an open defect, not settled by this document.

---

## 3. Current-state audit: is OpenISD "doing things wrong"?

The T/S consistency-group formulas (Sd/Dd, the Q trio, Cms/Mms/Rms/Bl, Xmax(Hc,Hg), Vd, and
the two GAPS.md §A4 directions added for AD-8 — Fs from Mms+Cms, Re from Qes+BL+Fs+Mms) exist
in exactly **one** place:
[`solveConsistencyGroup`](http://localhost:8000/winisd/openisd/packages/engine/src/driver.ts#L46-L98)
in `@openisd/engine`. Every other site calls it instead of reimplementing:

- [`deriveDriver`](http://localhost:8000/winisd/openisd/packages/engine/src/driver.ts#L100-L160)
  (same file) layers required-field blocking validation on top of it for the "ready to simulate"
  case.
- [`Driver#derive()`](http://localhost:8000/winisd/openisd/packages/winisd/src/driver.ts#L351-L388)
  — the live UI path (`store.ts` wires the app to this class) — calls it directly for the
  progressive/partial-entry case, and separately calls `deriveDriver` for `.errors` only.
- [`deriveOpenISDFields`](http://localhost:8000/winisd/openisd/packages/winisd/src/openisdDerive.ts#L32-L56)
  (AD-8's `OpenISDDriver` adapter) is a thin wrapper: flatten the nested
  `readings[origin].read_value` shape, call `solveConsistencyGroup`, translate back.
- [`wdr.ts:toWdr`](http://localhost:8000/winisd/openisd/packages/winisd/src/wdr.ts#L14-L40) reads
  `Vd`/`Dd` straight off `deriveDriver`'s result — no local recomputation.

`Vd` is now SI (m³) everywhere — the one place that computed cm³ (`engine/driver.ts`, unused by
every actual caller) was the outlier and has been removed, not one of the two conventions kept
alongside the other. **The UI's Xmax(Hc,Hg) tooltip is now true**: `DriverDefineModal.vue:50-51`
claims "WinISD derives Xmax ≈ |Hc−Hg|/2", and the live path (`Driver#derive()` →
`solveConsistencyGroup`) actually runs that formula now, since the live path calls it directly
rather than only reaching it through `deriveDriver`'s discarded `.value`.

**Still open, not touched by this consolidation:**

- **Three SPL/`no` constants** (109 inferred / 112.1 / 112.2) — see §2 row 18.
  `solveConsistencyGroup` deliberately excludes the `no`/SPLref/USPL/SPL chain; each of the
  three call sites still computes it inline, unchanged, pending its own dedicated formula audit.
  None of the three is currently wired to what the UI displays (`DriverEditorModal.vue`'s
  SPLref/USPL fields bind to the raw entered value).
- **DISCOVERIES.md BUG-006** — the Re-from-Qes+BL+Fs+Mms direction reproduces the naive
  hand-calc (6.520 on the Beyma fixture), not WinISD's own recomputed value (6.439). Open,
  unexplained, asserted-not-fixed by `openisdDerive.test.ts`.
- **GAPS.md §A4** — E/C/N derivation is still one-directional per field, not a true
  small-system group solver. The two new directions are additional forward substitutions in
  the same style as the rest, not a structural fix.
- `Driver#derive()` still doesn't import the "authoritative"
  [`engine/alignments.ts:40`](http://localhost:8000/winisd/openisd/packages/engine/src/alignments.ts#L40)
  EBP function.

---

## 4. Target architecture (implements TODO.md QT39 + BACKLOG.md item 1)

Already ruled by the human, restated here as the binding scope, not re-decided:

> *"100% retire calc code in python and reimpl it js. python will call js for all calcs. one
> source of truth. calcs will live in openisd. units MUST be SI throughout up until point of
> use."* — [TODO.md:2407-2409](http://localhost:8000/winisd/winisd_tools/TODO.md#L2407-L2409)

> *".wdr is generated ONLY on demand… by calling a JS `ymlToWdr()`/equivalent lib function…
> the Python pipeline invokes the JS lib as an external program (subprocess call to a Node CLI
> wrapping the same function the UI calls)"* — [BACKLOG.md:33-40](http://localhost:8000/winisd/openisd/BACKLOG.md#L33-L40)

This document's job is to fix the fact that **"calc lives in openisd" is not yet true even
within openisd** (§3), and to close two gaps the existing rulings don't cover (§5, §6).

### 4.1 Collapse the three TS implementations to one

This is required groundwork before Python can call "the" JS calc — right now there is no single
JS calc to call. [ARCHITECTURE.md AD-6](http://localhost:8000/winisd/openisd/ARCHITECTURE.md#L314-L328)
already specifies the correct layering (`calc` = pure physics, zero WinISD concepts; `winisd` =
calls `calc`, adds WDR/ParState). §3 shows `winisd/driver.ts` violates its own layering by
reimplementing physics instead of consuming `engine`'s output. Fix:

- `winisd/driver.ts#derive()` must use `deriveDriver(...).value`, not reimplement Cms/Mms/Rms/Bl/
  Vd/no/SPL itself. Any field `winisd` needs that `deriveDriver` doesn't yet cover (e.g. its
  currently-different `no` formula, group 14) gets added to `engine`, once, with the group-14
  form proven correct in §2 — not duplicated.
- `wdr.ts`'s Vd unit workaround disappears once `engine`'s `Vd` is SI (m³) per the QT39 SI rule —
  the `*1e6` moves to a display-boundary formatter, never back into the model.
- Delete `engine/driver.ts:79-82`'s unconditional overwrite once `winisd` stops needing a
  parallel implementation to guard against it — one derivation authority, one set of guards.
- Add the CI parity guard this project already has precedent for
  ([`test_driver_type_enum_parity.py`](http://localhost:8000/winisd/winisd_tools/scrapers/tests/test_driver_type_enum_parity.py#L1))
  as a **same-language** guard: a test asserting `engine`'s `deriveDriver` and `winisd`'s
  `Driver#derive()` never diverge, until the second is deleted outright.

### 4.2 Python's calc code — what actually retires

Per the SI-boundary distinction TODO.md QT39 itself draws
([`:2434-2438`](http://localhost:8000/winisd/winisd_tools/TODO.md#L2434-L2438)): the DERIVATION
retires, the .wdr/openisd.yml PROJECTION (unit conversion into WinISD's fixed-slot INI format)
does not, because it isn't calc — it's a file-format concern symmetric with the JS side's own
`wdr.ts`. Concretely, in `model_wdr.py`:

| Retires (calc) | Stays (projection / DQ) |
|---|---|
| [`:370`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L370) `vd = Sd*Xmax` | `_mm()` unit conversion ([`:381-389`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L381-L389)) |
| [`:374`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L374) `dd = √(4Sd/π)` | `_build_parstate()` ([`:263-303`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L263-L303)) — becomes a wrapper over whatever E/C/N the JS call returns |
| [`:375`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L375) `ebp = Fs/Qes` | `_WDR_FIELD_SPEC` range validation ([`:55-127`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L55-L127)) — this is DQ, not calc; keeps range-checking whatever value (scraped or JS-derived) lands in the field |
| `_WDR_CALCULATABLE` DQ-tolerance formulas ([`:453-473`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L453-L473)) | becomes: call the JS calc, compare its answer to the scraped value, flag `DqKind.CALC` on mismatch — same DQ semantics, formula now sourced from JS instead of reimplemented |

### 4.3 Interface shape

Python reaches `@openisd/engine` through an embedded V8 runtime (`mini-racer`), in-process —
not a subprocess, not a CLI, not a daemon. Decision and the stability comparison behind it:
[MATH_MIGRATION.md §9.2](http://localhost:8000/winisd/openisd/MATH_MIGRATION.md#L1039-L1055).
The API contract and fault surface it calls through:
[MATH_MIGRATION.md §6](http://localhost:8000/winisd/openisd/MATH_MIGRATION.md#L474-L491). The
same embedded runtime is the bridge for the `.wdr`-writer call too (`ymlToWdr()`) — one process,
one JS engine instance, not a second transport for a second function in the same codebase.
`BACKLOG.md:39-47` still says "subprocess call to a Node CLI" for that call; corrected below.

---

## 5. CNE / provenance — mostly already built, one gap to close, one bug to fix

The mechanism the human called "CNE" already exists in this codebase under the name **E/C/N**,
matching WinISD's own `ParState` semantics exactly. This is not a gap to design from scratch.

**Proof it exists and matches the requirement** ("presence does not imply entered — a
computed value must be recorded as computed, threaded from driver class through to the file"):

- Design doc states the exact rule the human just restated independently:
  *"C = the field has a value and was not entered (derivable, given the E-set); E = the human
  entered it ← the only fact not recoverable from the values"* —
  [docs/DRIVER_ADT_DESIGN.md:28-32](http://localhost:8000/winisd/openisd/docs/DRIVER_ADT_DESIGN.md#L28-L32).
- Implemented as the single mutation-gated accessor `cell(field)` —
  [`winisd/driver.ts:135-146`](http://localhost:8000/winisd/openisd/packages/winisd/src/driver.ts#L135-L146) —
  which returns `state: 'E'` only if the field is physically present in `#inputs` (the one thing
  `enter()`/`clear()` touch), else `'C'` if computable, else `'N'`. There is no separate flag
  that can drift from the value, by construction.
- Carried into the file format correctly: `Driver.raw()` **excludes C fields on principle** —
  *"Computed (C) fields are deliberately excluded: raw() is 'what was entered'"* — so `.owdr`'s
  `inputs` object can never contain a calculated value; reload always recomputes C fields fresh
  rather than trusting a stale stored one.
- WinISD's own file-level equivalent (`ParState`) is independently, correctly implemented on
  the Python side too — `_build_parstate()` marks `Dd`/`Vd`/`EBP` as `C` only when actually
  computed, `E` when manufacturer-published
  ([`model_wdr.py:280-301`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L280-L301)),
  with an explicit warning against the failure mode the human is worried about already written
  into the schema doc: *"A scraper that writes a fixed ParState for every driver… will mark
  computed fields like Qts, Vd, Dd as E — permanently pinning them"* —
  [WDR_SCHEMA.md:386](http://localhost:8000/winisd/openisd/WDR_SCHEMA.md#L386).

**The one live bug this mechanism has today** is the one already named in §3: because
`winisd/driver.ts:393` discards `deriveDriver`'s `.value`, the Xmax(Hc,Hg) case never reaches
`cell('Xmax')` at all — it's not mismarked, it simply never fires, so a driver with Hc/Hg but no
Xmax shows `state: 'N'` where WinISD itself would show `C`. Fixed by §4.1.

**The one real gap:** none of this reaches `.owdr` files loaded from `openisd.yml`/`driver.yml`
on the Python side, because — confirmed by an exhaustive search of the `openisd` tree — **nothing
reads `openisd.yml` today.** `.owdr` and `openisd.yml` are two disconnected formats that share a
naming root only. This means BACKLOG.md's own line 25, *"the app reads `openisd.yml` only,"* is
not true of any code that currently exists — it's a future-tense design intent written in
present tense. **This needs the user's decision, not an assumption:** is `openisd.yml` meant to
become the actual `.owdr` (i.e. same file, and the current `DriverJSON`/`.owdr` shape is
provisional), or are they intentionally two different artifacts (Python's full-provenance
sidecar vs. the app's slim edit-session file) that need an explicit sync step? Either answer is
consistent with everything found this session; nothing found here decides it.

---

## 6. Precision propagation — the gap TODO.md QT39 doesn't mention

QT39 says "all calcs" move to JS. Python currently has a calc-adjacent capability with **no JS
counterpart at all**: standard-uncertainty propagation through derived values, via the
`uncertainties` package —
[`model_wdr.py:15`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L15)
(`from uncertainties import umath`), used in
[`derived_precisions()`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L492-L528)
and [`precision.py`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/precision.py#L57-L83)
(`ufloat`, `half_width`). This reports how many digits of a derived value (Vd, Dd, EBP) are real,
given the rounding precision each source datasheet actually printed — related, adjacent finding
already logged separately at
[BUG_20260729](http://localhost:8000/winisd/winisd_tools/bugs/BUG_20260729_derived-values-are-written-with-16-digits-of-float-noise-and-no-propagated-precision.md#L1).

If "all calcs" genuinely means all — and Vd/Dd/EBP are exactly the derived values this precision
tracking exists for — then this propagation must be ported to JS, not left behind as a Python
capability calling into a JS-only formula set. **No JS uncertainty-propagation utility exists
today** — confirmed, zero hits for `uncertainties`/`ufloat`/equivalent anywhere in `packages/`.

**Scope for that port** (not designed here, flagged for its own task): a JS equivalent of
`ufloat(value, half_width)` with `+`, `*`, `/`, `√` propagation sufficient for exactly the three
formulas in §2 rows 6/12/20 (Dd, EBP, Vd) — the same restricted set Python currently propagates
through, no more.

---

## 7. Open decisions requiring the human, not assumed by this document

1. **§2 row 18** — which of the three SPL/no constants (109 inferred, 112.1, 112.2) is correct,
   and why do three exist? Needs a dedicated probe against `drivers/sample/`-style empirical
   files before Phase 1 starts.
2. **§5** — is `.owdr` meant to converge with `openisd.yml`, or are they intentionally separate
   with a sync step? BACKLOG.md's current wording assumes convergence without saying so.
3. ~~§4.3 — the Node-CLI contract~~ **CLOSED (human, 2026-08-02): not a Node CLI at all — an
   embedded JS runtime, in-process.** See
   [MATH_MIGRATION.md §9.2](http://localhost:8000/winisd/openisd/MATH_MIGRATION.md#L1039-L1055):
   V8 via `mini-racer`, picked over `quickjs-ng` and `PythonMonkey` on stability grounds. §4.3's
   "Now filled in" pointer to MATH_MIGRATION.md §6 for the CLI package/entry-point/contract is
   now stale in the same way — that section describes an API contract that still holds, but the
   transport it names has changed from subprocess-CLI to embedded-runtime.

---

## 8. Documentation hygiene found in passing

[PLAN_DRIVER_ADT.md:15](http://localhost:8000/winisd/openisd/PLAN_DRIVER_ADT.md#L15) states *"No
code has started… No `Driver` class, no `enter`/`clear`, no `fromWdr`, no per-field marks
anywhere yet."* This is stale: `packages/winisd/src/driver.ts` implements exactly that class
today, wired live into `store.ts`. Per this project's own rule against historical commentary in
docs, the fix is to update that status section to reflect what's on disk, not to leave the
"no code has started" claim standing — a future agent trusting that file will waste time
re-planning work that already exists.
