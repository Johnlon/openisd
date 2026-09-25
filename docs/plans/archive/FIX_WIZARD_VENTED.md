# PLAN — FIX_WIZARD_VENTED (New Project wizard: vented + BP4th alignment steps)

**Status: VENTED DONE 2026-09-22 — all 5 WinISD vented alignments wired, bit-exact against
35 WinISD captures
([VENTED_ALIGNMENT_FORMULAS.md](http://localhost:8000/winisd/openisd/docs/research/VENTED_ALIGNMENT_FORMULAS.md?html)).
The 2026-09-21 "QB3 only" ruling is superseded by John's 2026-09-22 "option 1": wire WinISD's own
formulas. BP4th still out of scope (§4). Remainder:
[FIX_WIZARD_VENTED-remains.md](http://localhost:8000/winisd/openisd/docs/plans/FIX_WIZARD_VENTED-remains.md?html).**

## 1. Goal

WinISD's wizard has an alignment step for box types other than sealed. Today's wizard skips
straight from "Type of design" to "Project Information" for every non-sealed box type — no
alignment step at all. Bring vented and 4th-order bandpass in line with WinISD.

## 2. Ground truth (screenshots, John's own WinISD run, Aug 2026 — confirmed still valid for
this work 2026-09-21)

| Box type | Alignment step | Screenshot |
|---|---|---|
| Vented | dropdown, 5 options | [new_project_wizard_4_vented_allignment.png](http://localhost:8000/winisd/openisd/docs/winisd_screenshots/new_project_wizard_4_vented_allignment.png) |
| 4th order bandpass | dropdown, 8 options | [new_project_wizard_4_4th_order_allignment.png](http://localhost:8000/winisd/openisd/docs/winisd_screenshots/new_project_wizard_4_4th_order_allignment.png) |
| 6th order bandpass | disabled, "\<None available\>" | [new_project_wizard_4_6th_order_allignment.png](http://localhost:8000/winisd/openisd/docs/winisd_screenshots/new_project_wizard_4_6th_order_allignment.png) |
| ABC | disabled, "\<None available\>" | [new_project_wizard_4_abc_allignment.png](http://localhost:8000/winisd/openisd/docs/winisd_screenshots/new_project_wizard_4_abc_allignment.png) |
| Passive radiator | not an alignment step — own step, Vas/Qms/Fs/Sd/Xmax | [new_project_wizard_4_pr_params.png](http://localhost:8000/winisd/openisd/docs/winisd_screenshots/new_project_wizard_4_pr_params.png) |

Vented dropdown options, in order, default selected marked:

| Label | Default |
|---|---|
| QB3 Quasi-butterworth | |
| BB4/SBB4 (Super-)boom-box | |
| C4/SC4 (Sub-)Chebyshev | **yes** |
| EBS3 extended bass shelf -3 dB | |
| EBS6 extended bass shelf -6 dB | |

BP4th dropdown options — 4 ripple values × 2 gain values, in order, default = first row:

| Passband ripple | Passband gain |
|---|---|
| 0.00 dB | 0 dB (**default**) |
| 0.35 dB | 0 dB |
| 1.25 dB | 0 dB |
| 2.70 dB | 0 dB |
| 0.00 dB | -3 dB |
| 0.35 dB | -3 dB |
| 1.25 dB | -3 dB |
| 2.70 dB | -3 dB |

6th order bandpass and ABC: dropdown shows literal text `<None available>`, plus the line
"Current version of WinISD can't calculate alignments for chosen box-type". WinISD itself has
no formula for these — nothing to build, just show the same disabled state.

## 3. Current state (facts)

| Fact | Where |
|---|---|
| `totalSteps` is 5 for sealed, 4 for everything else — no alignment step exists for any non-sealed box type; wizard jumps box-type → project info | [OgNewProject-hooks.ts:129](http://localhost:8000/winisd/openisd/packages/ui/src/hooks/OgNewProject-hooks.ts#L129) |
| Vented box creation hardcodes `vent.diameter_m = 0.05`, `tuning_hz = 35` — not derived from any alignment choice | [OgNewProject-hooks.ts:299-303](http://localhost:8000/winisd/openisd/packages/ui/src/hooks/OgNewProject-hooks.ts#L299) |
| `bandpass4` creation hardcodes the same `0.05` / `35` on the front chamber, plus a separate `frontVol` field already in the wizard (step 3) | [OgNewProject-hooks.ts:309-313](http://localhost:8000/winisd/openisd/packages/ui/src/hooks/OgNewProject-hooks.ts#L309) |
| Engine has all 5 WinISD vented alignments (`ventedAlignment(alignment, Fs, QtsLoaded, Vas, Ql)`), WinISD's own polynomials + BB4 algebra, validated to 9e-15 | [boxDesign.ts](http://localhost:8000/winisd/openisd/packages/design/engine/boxDesign.ts#L149), [vented-alignment.test.ts](http://localhost:8000/winisd/openisd/packages/design/test/engine/vented-alignment.test.ts) |
| No BP4th alignment formula (ripple/gain → Vb/Fb) anywhere in the codebase | grep of `boxDesign.ts`, no match |
| `SEALED_ALIGNMENT_OPTIONS` is the pattern to mirror: a frozen `SelectorOption<number>[]` in `design/fields/options.ts`, paired with an engine `closestXAlignment()` / `xFromAlignment()` function pair | [options.ts:41-53](http://localhost:8000/winisd/openisd/packages/design/fields/options.ts#L41) |
| No passive-radiator wizard step exists either (Vas/Qms/Fs/Sd/Xmax) — `defaultPassiveRadiator()` fills placeholder values today, no user input step | [OgNewProject-hooks.ts:304-307](http://localhost:8000/winisd/openisd/packages/ui/src/hooks/OgNewProject-hooks.ts#L304) |

## 4. Alignment math — RULED (John, 2026-09-22): wire WinISD's own formulas

- **Vented dropdown ships all 5, WinISD order and labels, C4/SC4 default.** Formulas are
  WinISD's, decompiled from `winisd.exe` and reproduced to floating-point noise — see
  [VENTED_ALIGNMENT_FORMULAS.md](http://localhost:8000/winisd/openisd/docs/research/VENTED_ALIGNMENT_FORMULAS.md?html).
  The design input is the source-loaded Qts (project `Rs_ohm`, 0.1 Ω default) and the box `Ql`
  (10 default), exactly as WinISD's wizard does it.
- **BP4th (4th order bandpass) is OUT OF SCOPE for this plan** — no formula in the codebase,
  not ruled on, do not build any of the 8 ripple/gain options. `bandpass4` keeps today's
  hardcoded `0.05`/`35` behaviour untouched.
- **6th order bandpass / ABC**: unchanged, still no alignment step (§6 non-goal, unaffected by
  this ruling).

## 5. Task list

1. Wizard step plumbing: `totalSteps`/`currentStepNumber`/`next()`/`back()` grow a step 4 for
   `vented` only (not `bandpass4` — out of scope, §4), same slot sealed uses; every other box
   type keeps skipping straight to step 5 (project info) exactly as today.
2. Vented alignment UI: dropdown bound through `selectedOption` (same rule as the sealed one),
   `VENTED_ALIGNMENT_OPTIONS` in `design/fields/options.ts` — all 5, `selectVentedAlignment()`.
3. Wire `ventedAlignment()` into `createProject()`'s `vented` branch — `Vb`/`Fb` from the chosen
   alignment, source-loaded Qts, project `Rs_ohm`, box `Ql`.
4. Hook tests first (TDD, per `tdd.md`) for the option list + step transition + design wiring,
   then the browser spec for the new step order.

All four done 2026-09-22.

## 6. Non-goals

- No BP4th (4th order bandpass) alignment step at all — out of scope, no formula sourced (§4).
- No 6th-order bandpass or ABC alignment work — WinISD itself can't calculate these; the
  wizard should show the same disabled "\<None available\>" state, nothing to compute.
- No passive-radiator wizard step (Vas/Qms/Fs/Sd/Xmax) — separate gap, not this plan.
- No change to the sealed step (already landed).
