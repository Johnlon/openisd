# Report — external cross-check oracle for PR / bandpass (SpeakerBoxLite investigation)

**Date:** 2026-07-04
**Status:** Investigation complete. **No new oracle wired in.** Recommendations below.

This is a **report**, not a functional change — see "Contents & recommended follow-up"
at the end for what it does and doesn't cover.

---

## 1. What was asked vs. what happened

`PLAN_SBL_CROSSCHECK.md` proposed adding **SpeakerBoxLite (SBL)** as a second numeric
oracle alongside micka.de, specifically to validate the **passive-radiator** and
**bandpass** scenarios micka cannot model.

I implemented it, got it working against the live site, then — on your direction —
**backed it out** because driving SBL is slow and brittle, and pivoted to finding a
simpler/reputable alternative. The net conclusion:

> **No external web tool is both easy to integrate and passive-radiator-capable.**
> Use micka (+ optionally lautsprechershop) for sealed/vented; validate PR/bandpass
> against a **synthesized regression baseline** anchored to the Thiele/Small literature.

---

## 2. SpeakerBoxLite — findings (why it was abandoned)

SBL _is_ fully drivable — I validated a sealed cross-check live — but only after
substantial reverse-engineering. It is a client-side **Bootstrap-Vue SPA**:

- No stable input `name`/`id`; fields are `input.form-control` keyed only by row label.
- **Two consent overlays** (top cookie bar + a late-rendering Quantcast CMP dialog that
  intercepts clicks).
- Hidden desktop/mobile duplicate controls (needs wide viewport + `:visible`).
- Tabbed left panel: **Speaker / Network / Enclosure / Port / Radiator / Box**.
- **Results compute only on a "Draw" button**, not on blur; computed values are written
  back into the _other_ input fields.
- Box losses (`Ql`) must be set lossless (≈1000) to match OpenISD — SBL defaults to `Ql=7`.

**Validated result (sealed, lossless):** entering the Butterworth volume (≈12.2 L) →
SBL `Qtc = 0.706`, matching OpenISD/target **0.707**. Vb=20 L → SBL `Qtc = 0.6` vs
OpenISD `0.601`. So the physics agrees; the automation cost is the problem.

**Verdict:** too slow/brittle for a routine oracle. Abandoned.

---

## 3. ⚠ Discrepancies worth investigating ("there may be bugs")

Two independent tools report a **higher −3 dB frequency than OpenISD's `fc`** for the
same Butterworth sealed box (Fs=37, Qts=0.38, Vas=30, Qtc≈0.707):

| Quantity            | OpenISD | micka   | SpeakerBoxLite | lautsprechershop |
| ------------------- | ------- | ------- | -------------- | ---------------- |
| `Vb` (Butterworth)  | 12.18 L | 12.21 L | ≈12.2 L        | ~12 L (gross)    |
| `Qtc`               | 0.707   | —       | 0.706          | (target 0.707)   |
| `fc` / `F3` (−3 dB) | 68.8 Hz | 68.79   | **74.5 Hz**    | **81 Hz**        |

- **Vb and Qtc agree across all four tools** — the closed-box volume maths is sound.
- **The −3 dB frequency does not.** For a _lossless_ 2nd-order Butterworth, F3 = fc
  exactly, so 68.8 Hz is theoretically correct. SBL (74.5) and lautsprechershop (81) both
  read higher. **Most likely a definitional difference** (they may fold in driver `Le`/`Re`
  roll-in, box losses, or define F3 against a different reference) rather than an OpenISD
  bug — **but it has not been proven either way and should be checked.** OpenISD's own
  stat is `fc` (system resonance), not a separately-computed `F3`; confirm whether the UI
  should also surface an `F3` and whether `fc` is being conflated with `F3` anywhere.

This is the main "possible bug" flag from the investigation.

---

## 4. Oracle survey (2026-07-04)

| Tool                    | Coverage                           | Integration ease                                                                                             | PR? | Verdict                                                   |
| ----------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------ | --- | --------------------------------------------------------- |
| **micka.de**            | sealed, vented                     | Easy (form POST)                                                                                             | ❌  | **Adopted** (already wired, passing)                      |
| **lautsprechershop.de** | sealed, vented                     | Easy (static page, named inputs, inline JS, no cookie banner)                                                | ❌  | **Candidate** — Vb agrees, `f3` needs reconciliation (§3) |
| **SpeakerBoxLite**      | sealed, vented, 4th/6th BP, PR, TL | Hard (SPA, consent, Draw)                                                                                    | ✅  | Rejected as oracle                                        |
| **Sine Design**         | sealed, ported, bandpass, PR       | Hard (Next.js SPA, **no compute API** — verified only `?_rsc=` route-prefetch, computes client-side/offline) | ✅  | Rejected as oracle; recorded as a capable tool            |
| **mh-audio.nl**         | sealed, vented, **PR**             | Unusable — **http-only, unreachable over HTTPS**                                                             | ✅  | Not usable                                                |

Also noted (web UIs, no API, not evaluated deeply): AJ Designer, Sparked Builds, UniBox
(desktop), AudioGrid, the12volt.

**Key gap:** every PR-capable tool is a client-side SPA (or offline). There is no
easy-to-integrate PR web oracle.

---

## 5. lautsprechershop.de — integration notes

`https://www.lautsprechershop.de/tools/t_box_closed_en.htm` is trivial to drive:

- Inputs: `input[name="fs"|"vas"|"qts"|"qbvalue"]` (qbvalue = target Qtc).
- Compute: inline JS `geschlossen()`, fired by the `Calculate Cabinet` button.
- Outputs (readonly): `input[name="vb"|"f3"|"f8"|"db"]`. No SPA framework, no cookie banner.

A ~15-line Playwright spec can fill + click + read. **But** wire it in only after the
`f3` discrepancy in §3 is understood — assert on `Vb` (which agrees) first, not `f3`.
The vented URL you gave (`t_box_vented_hoges_en.htm`) returned a sealed-titled page and
needs a separate look.

---

## 6. Recommendation

1. **Sealed/vented:** keep micka. Optionally add lautsprechershop as an easy second
   oracle, asserting `Vb` only until `f3` is reconciled.
2. **PR + bandpass:** add a **synthesized regression baseline** — freeze OpenISD's own
   engine output as a golden fixture, with the closed-form Thiele/Small derivation and a
   literature citation in the test (Small, JAES 1972; Beranek, _Acoustics_).
   ⚠ **This is a regression guard, not independent validation** — label it as such in the
   test so no one mistakes "it passes" for "it is correct." The independent anchor is the
   analytic formula in the comment, not the frozen number.
3. **Investigate §3** (the F3/fc discrepancy) before trusting any tool's `f3`.

---

## 7. Feature gaps SBL / Sine Design exposed (for BACKLOG / plans)

Functional simulation features these tools have that OpenISD lacks (some already in
`BACKLOG.md`):

- **6th-order bandpass — parallel _and_ series** (two distinct alignments; the split was
  new information — micka never surfaced it). _(BACKLOG updated.)_
- **Transmission line** enclosure. _(already backlog)_
- First-class **box-loss input `Ql`** (OpenISD's loss model is partial — `Qa` is backlog).
- **PR design helpers:** recommended PR area range, "Fb needed vs Fb real" read-outs,
  PR parametrised by `Fs/Vas/Qms/Sd/Added Mass`.
- **Port options:** rectangular/round, flared/flush end counts, multiple ports (1–4).
- **Computation-model toggle** (simple vs complex) and construction outputs (cutting map).

(Functional features only — no UI-layout comparison is recorded in tracked docs.)

---

## 8. Contents & recommended follow-up

Doc-only:

- `REPORT_ORACLE_CROSSCHECK.md` — this report.
- `OTHER_TOOLS.md` — §3 rewritten from "SpeakerBoxLite = second oracle" into a neutral
  **oracle-strategy + tool-survey** section reflecting the decisions above.

**Recommended follow-up (not applied here):** revert `packages/ui/test/scenarios.ts` to
its pre-SBL baseline — the `sbl` field, the PR/bandpass scenarios and the `bandpass4` test
type were added on `dev` only to feed the abandoned SBL spec and are now unused. The SBL
spec file was already removed from `dev`'s working tree (it was never committed).

### ⚠ Note on `dev`'s already-committed state

Before the pivot, some SBL groundwork was **committed to `dev`** (commits
`725922772` and `dcfc329b`): the earlier `OTHER_TOOLS.md` "second oracle" framing, the
`BACKLOG.md` parallel/series reword (worth keeping), and the SBL scenarios in
`scenarios.ts`. This branch's reverts are **not** applied to `dev` — reconcile deliberately
if you want `dev` cleaned, to avoid clashing with the concurrent engine/UI rebuild.
