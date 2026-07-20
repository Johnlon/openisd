# SpeakerBoxLite cross-check — plan

Companion to [BACKLOG.md](BACKLOG.md) · [OTHER_TOOLS.md](OTHER_TOOLS.md) ·
existing oracle: `packages/ui/test/micka-crosscheck.browser.spec.ts`.

---

## Goal

Add [speakerboxlite.com](https://speakerboxlite.com) as a second external oracle,
alongside micka.de, and use it to cross-check every enclosure type it supports that
OpenISD also implements. Where SpeakerBoxLite (SBL) supports an enclosure type
OpenISD does not yet implement, record that as a backlog gap instead of a test.

## Why a second oracle

`micka.de`'s `#ideal` calculator does not support passive radiators — confirmed by
driving its live form: switching to `parameterinput` mode exposes exactly
`fs, vas, qts, qms, Re, Le, Rg, ql, rd, qtc, imp_phase, freq_phase, vb2, rd2, lv2, ql2,
temp_luft` (sealed `qtc`, vented `rd`/`vb2`/`rd2`/`lv2`, a leakage-Q knob) — no PR mass,
compliance, area, or count fields. A full-text search of the page for
"passiv"/"radiator"/"drone" returns zero hits. So `micka-crosscheck.browser.spec.ts`
cannot validate the PR scenario already shipped in the engine (`BACKLOG.md` — "Shipped").

SpeakerBoxLite's enclosure-type list (confirmed live in its DOM, not from marketing
copy) is:

```
Closed
Vented
4th Order Bandpass
6th Order Bandpass (Parallel)
6th Order Bandpass (Series)
Passive Radiator
Transmission Line
```

## SBL type → OpenISD status → action

| SBL enclosure type            | OpenISD engine support                                                                        | Action                                                                                                                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Closed (sealed)               | Shipped (`alignments.ts`)                                                                     | Add cross-check scenario + spec case                                                                                                                                                        |
| Vented                        | Shipped                                                                                       | Add cross-check scenario + spec case                                                                                                                                                        |
| Passive Radiator              | Shipped                                                                                       | Add cross-check scenario + spec case — **this is the main gap micka can't cover**                                                                                                           |
| 4th Order Bandpass            | Shipped                                                                                       | Add cross-check scenario + spec case                                                                                                                                                        |
| 6th Order Bandpass (Parallel) | Not implemented — `BACKLOG.md` P2 "6th-order bandpass (both chambers ported)"                 | No test yet; backlog item already exists but doesn't distinguish parallel/series — refine wording (see below)                                                                               |
| 6th Order Bandpass (Series)   | Not implemented                                                                               | Same backlog item — the parallel/series distinction is new information from SBL and isn't currently captured in `BACKLOG.md`; split into two sub-bullets or note both alignments explicitly |
| Transmission Line             | Not implemented — `BACKLOG.md` P3 "Transmission line / quarter-wave (line length + stuffing)" | No test yet; existing backlog item already covers this, no change needed beyond confirming SBL as a future oracle for it                                                                    |

So only the "6th-order bandpass" backlog bullet needs editing (parallel vs. series
alignment wasn't a known distinction before this research); transmission line's
existing bullet already matches what SBL calls it.

## Implementation steps

1. **Extend `scenarios.ts`** — add a `box.type: 'bandpass4'` variant (bandpass4 has
   shipped engine support per `BACKLOG.md` but has no scenario yet, sealed/vented/pr are
   the only types currently in `Scenario['box']['type']`) and a `pr` scenario with
   expected values. Add a second oracle field alongside `micka?: Record<string,
string>` — e.g. `sbl?: Record<string, string>` — so a scenario can carry either or
   both oracles' expected values.

2. **Explore SBL's per-type field names** — only the `Closed` type's fields have been
   confirmed live so far: `Ql (Box losses)`, `Vb(l)`, `Qtc`, `F3(Hz)`, plus a
   `VOLUME GENERATION` alignment-preset picker (`Max flat amplitude Butterworth-B2`,
   `Max flat delay Bessel-BL2`, `Critically-damped`, `Chebyshev C2`, `Chebyshev C2 max
power` — the classical sealed-box alignment names, relevant to the existing
   `BACKLOG.md` "Expand vented alignment presets" item, which could be broadened to
   cover sealed presets too). Vented, 4th Order Bandpass, and Passive Radiator field
   names are NOT yet confirmed and must be driven live (as this plan's steps 3+ run)
   before the spec can be written — do not assume field names from the Closed type
   generalize.

3. **Write `packages/ui/test/speakerboxlite-crosscheck.browser.spec.ts`**, mirroring
   `micka-crosscheck.browser.spec.ts`'s structure: navigate to SBL, enter driver T/S
   under "parameterinput"-equivalent entry, select enclosure type, fill box-specific
   fields, submit/read the results panel, assert against `scenario.sbl`. Follows the
   same "external oracle, not normal CI, run on scenario add / formula change" policy
   as the micka spec's header comment.

4. **Update `BACKLOG.md`** — "Enclosure types & box model" section: split or reword
   the "6th-order bandpass (both chambers ported)" bullet to note the parallel vs.
   series tuning distinction SBL exposes as two separate alignments.

5. **Update `OTHER_TOOLS.md`** — add SpeakerBoxLite as a documented external tool
   (mirroring the existing micka.de entry) and update open question #1 to note micka's
   confirmed lack of PR support.

## Open question for human to decide

Should the Playwright spec drive SBL's actual rendered UI (as the micka spec does —
slower, exercises the real form), or is there a lighter-weight path (e.g. an SBL API
endpoint observed via network trace) that avoids full page automation? Not
investigated — the DOM exploration so far only used `document.querySelector` /
`click()` via `javascript_tool`, no network trace was captured.
