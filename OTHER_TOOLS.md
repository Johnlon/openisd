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

## 3. Open questions

| # | Tool/Source | Question | Priority |
|---|---|---|---|
| 1 | micka.de | Cross-check oracle for driver + box simulations | [documented in test/scenarios.js] |
| 2 | REW | Impedance + FR measurement reference | Open |
| 3 | LEAP | High-end simulation suite comparison | Open |
