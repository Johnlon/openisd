# Research on external tools and data sources

This file documents findings, observations, and compatibility notes for tools and
data sources that OpenISD users interact with or that inform our design decisions.

---

## 1. loudspeakerdatabase.com scraper — third-party collection

**Collection:** `drivers/loudspeakerdatabase/` (14 WDR files)

**Source:** Third-party scraper (not WinISD, not OpenISD's current scraper)

### Quality findings (analysis: 2026-06-28)

**EBP computation broken:**

- 6/14 files: EBP field completely absent
- 7/14 files: EBP=0 when both Fs and Qes are present and non-zero
- Example: Beyma 10BR60 V2: Fs=29 Hz, Qes=0.44 → should compute EBP ≈ 66, written as 0

**ParState issues:**

- All 14 files use hardcoded constant: `EEECEENNEENEEEEEEEEEEECENNCCCNNNCCCCECNNNNNNNNECC`
- Does not match dynamically-computed ParState seen in real WinISD files (matt collection)
- Suggests use of older OpenISD scraper version or independent implementation

**Metadata issues:**

- Most files dated December 2025 (future dates; likely test or placeholder data)
- Several files: DateAdded/DateModified fields completely empty
- VCCon=2 (serial connection) as default (unusual for single-VC drivers)

**Vd/Dd coverage:**

- Vd: 14/14 present, 14 computed, 0 zeros (100% perfect coverage)
- Dd: 14/14 present, 14 computed, 0 zeros (100% perfect coverage)
- Contrast with matt (411 real WinISD files): Vd has 9 zeros, Dd has 0 zeros

### Conclusion

loudspeakerdatabase files exhibit data quality issues not seen in real WinISD entries (matt collection).
**Not suitable as reference** for validating WDR format, scraper correctness, or WinISD behaviour.

**Use matt collection (411 real WinISD files) as authoritative reference.**

---

## 2. WinISD parameter entry — community best practices

**Source:** mtg90 (aka "Matt") via:

- AVS Forum: https://www.avsforum.com/threads/common-sub-driver-winisd-files.2928258/
- HomeTheaterShack forum: https://www.hometheatershack.com/forums/diy-subwoofers-general-discussion/6330-winisd-pro-tutorial-download-detailed-guide-how-use-winisd-pro.html

**Authority:** mtg90 is the curator of `drivers/matt/` (411 WDR files), which are the reference collection for real WinISD behaviour. These recommendations come from the person who created that collection.

### Recommended entry sequence (proven by ~50+ drivers)

1. **Mms and Cms first** (results in Fs auto-calculated)
   - If Mms/Cms unavailable, enter Fs instead
   - **Note:** Cms units vary (meters, millimeters, micrometers); if calculated Fs is way off, try re-entering Mms+Fs and check if Cms decimal point needs adjustment
2. **Enter Sd, Bl, Re** (triggers more auto-calculations; Qms/Qts may still be blank)
3. **Enter Qms or Rms** (whichever is available; Qms more commonly published)
4. **Enter Qes** (if Mms/Cms were not provided; triggers additional auto-calculations)
5. **Enter Hc, Hg, Pe** (optional but Pe helpful for power modeling)
6. **Set voice coil count** (dual-VC drivers may auto-adjust Bl/Re; monitor when switching series/parallel)
7. **Correct Znom** (often defaults to 6Ω when it should be 2, 4, or 8Ω based on configuration)
8. **Enter Xmax and remaining fields** — **DO NOT manually change blue auto-calculated fields**

### Conflict avoidance technique

From same thread:

- Clear all fields first
- Enter Qes, Tab
- Enter Qms, Tab (multiple times to let Qts calculate)
- Tab to Mms, enter Mms, Re, Bl, Le, Sd, Xmax, Pe (tabbing after each)
- Result: No conflicts; minor rounding errors acceptable

### Minimal entry levels

From same source — three levels of completeness:

**Full entry (preferred):**

```
Qms, Mms, Cms, Re, BL, Le, Sd, Xmax, Pe
```

(Minimum required for comprehensive modeling)

**Minimalistic entry:**

```
Qes, Qms, Fs, Vas, Re, Sd, Xmax, Pe
```

**Absolute minimum (basic modeling only):**

```
Qts, Fs, Vas, Sd, Xmax, Pe
```

**Critical note:** Ensure units from datasheet match WinISD's expectations. If Cms unavailable, enter Fs OR Vas (not both).

### Key insight

Minor calculated vs. spec discrepancies are normal (rounding). Significant differences indicate:

- Wrong datasheet values
- Misidentified units
- Need to contact manufacturer

**Implication for OpenISD:**

1. Scraper must aim for "full entry" level (9 fields) for professional-quality WDR files
2. Understanding these levels helps validate data quality — files missing multiple core fields may be incomplete
3. Use entry order + minimal levels to understand ParState patterns in real WinISD files

---

## 3. SpeakerBoxLite — second external oracle

**Site:** https://speakerboxlite.com · calculator at `/subwoofer-box-calculator/`

**Role:** Second independent cross-check oracle alongside micka.de, added specifically
to cover enclosure types micka cannot model. Consumed by
`packages/ui/test/speakerboxlite-crosscheck.browser.spec.ts` via the `sbl` field on each
scenario in `packages/ui/test/scenarios.ts`.

### Why a second oracle

micka.de's `#ideal` calculator models only sealed and vented boxes — it exposes no
passive-radiator or bandpass inputs, so it cannot validate the PR and 4th-order-bandpass
scenarios OpenISD already ships. SpeakerBoxLite covers both.

### Enclosure types (verified live 2026-07-04 by fetching the calculator page)

```
Closed
Vented
4th Order Bandpass
6th Order Bandpass (Parallel)
6th Order Bandpass (Series)
Passive Radiator
Transmission Line
```

Of these, OpenISD's engine implements Closed, Vented, 4th Order Bandpass and Passive
Radiator (`BoxType` in `packages/engine/src/types.ts`). The 6th-order bandpass
parallel/series split and Transmission Line are backlog items — see
`BACKLOG.md` "Enclosure types & box model". The parallel-vs-series distinction is
new information from SpeakerBoxLite (micka never surfaced it).

### Rendering & automation — confirmed live 2026-07-04

Driven with a headless Chromium exploration script (`build/` scratch, since deleted).
All of the following was observed in the rendered DOM, not inferred:

- **Client-side SPA (Bootstrap-Vue).** No `<input name>` / stable `id` on fields — every
  parameter input is `input.form-control`, and many share `id="fieldInput"`. Selectors
  must key off the row label, e.g. `.input-field-root:has-text("Fs(Hz)") input.form-control`.
- **Two consent overlays** must be dismissed first: a top cookie bar (`button` "Got it!")
  and a "Privacy and cookie settings" popup (Quantcast/IAB) that overlaps the left inputs.
- **Responsive duplicates:** the DOM holds hidden desktop+mobile copies of controls
  (`d-none d-md-block`); a wide viewport (≈1680×1050) and a `:visible` filter are required,
  otherwise `.first()` grabs a hidden node.
- **Left panel is tabbed:** `Speaker | Network | Enclosure | Box | …`.
  - _Speaker_ tab: driver T/S — `Fs(Hz)`, `Vas(l)`, `Qts`, plus SUB/WOOFER/… ,
    SIMPLE/COMPLEX computation model, LITE/EXPANDED parameter set, ONE/MULTIPLE/ISOBARIC.
  - _Enclosure_ tab: enclosure-type dropdown (`button.dropdown-toggle` → `a.dropdown-item`,
    options exactly the 7 above) plus the box fields (below).
  - _Box_ tab: physical realisation — `Material thickness(mm)`, `Port outside length(mm)`,
    `Displacement(l)`.
- **Enclosure fields per type** (all on the Enclosure tab; `Ql(Box losses)` defaults to 7):
  - Closed: `Vb(l)`, `Qtc`, `F3(Hz)`
  - Vented: `Vb(l)`, `Fb(Hz)`, `F3(Hz)`
  - Passive Radiator: `Vb(l)`, `Fb(Hz)`, `F3(Hz)`
  - 4th Order Bandpass: `front`, `front`, `rear`, `low`, `high`, `Bandwidth(Hz)`

### Two blockers to a working crosscheck spec (unresolved)

1. **No output field to read.** The Enclosure fields (`Vb`, `Qtc`, `Fb`, `F3`) are all
   _inputs_ — you enter whichever you know. Entering `Qtc=0.707` (or `Vb=12.2`) and clicking
   **Draw** did **not** populate the others; SBL's authoritative computed numbers are not
   written back into these inputs. Where SBL surfaces the computed result as parseable text
   (a values/list panel behind the graph toolbar's list icon, vs. graph pixels only) has not
   been located. Until it is, the spec has nothing reliable to assert against.
2. **Model direction likely differs for vented.** SBL's vented Enclosure tab exposes `Fb`
   as an input field (not a readout), with port length/material/displacement on the Box tab
   — so it appears to take `Vb` + target `Fb` and compute the port (⚠ inferred from field
   layout, not confirmed by watching it compute). That is the _inverse_ of OpenISD scenario
   2, which fixes port geometry (ø5cm×10cm) and computes `Fb=37.9`. A like-for-like `Fb`
   cross-check may therefore not be directly expressible in SBL's flow.

### Open question (still not decided)

Drive the rendered UI (heavier, and blocked on #1 above) vs. find an API/XHR endpoint that
returns computed results directly (would sidestep both blockers if one exists). No network
trace captured yet.

---

## 4. Open questions

| #   | Tool/Source    | Question                                                                                                                                                                                 | Priority                                                  |
| --- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1   | micka.de       | Cross-check oracle for sealed + vented simulations. ⚠ No PR/bandpass support — its `#ideal` form exposes no passive-radiator or bandpass fields (per PLAN_SBL_CROSSCHECK.md live check). | [documented in test/scenarios.ts]                         |
| 2   | SpeakerBoxLite | Second oracle for PR + bandpass (the types micka lacks). Drive-real-UI vs. API-endpoint approach undecided.                                                                              | [see §3; spec: speakerboxlite-crosscheck.browser.spec.ts] |
| 3   | REW            | Impedance + FR measurement reference                                                                                                                                                     | Open                                                      |
| 4   | LEAP           | High-end simulation suite comparison                                                                                                                                                     | Open                                                      |
