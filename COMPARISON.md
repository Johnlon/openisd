# Resonate — Feature Comparison

This table serves two purposes:
- **Promotional** — what Resonate offers today vs. the tools it replaces or complements.
- **Todo list** — features not yet implemented are marked 🚧 and linked to the roadmap.

Comparison is primarily against **WinISD** (the tool Resonate is designed to replace or
extend), with notes on other tools where relevant.

**Confidence markers** (WinISD column only — per the project's anti-hallucination rule):
- ✅ Confirmed — source: WINISD.md, WinISD help file, or direct user observation
- ⚠ Assumed — plausible but not directly verified; see WINISD.md for details
- ❌ Confirmed absent — observed directly or follows from platform constraints

---

## Platform & access

| Feature | Resonate | WinISD |
|---|---|---|
| Runs in browser — no install | ✅ | ❌ confirmed |
| Works on Mac and Linux | ✅ (any browser) | ❌ confirmed (Windows-only app) |
| Works offline | ✅ PWA / service worker | ✅ confirmed (desktop app) |
| Mobile / tablet | ⚠ responsive layout (not optimised) | ❌ confirmed |
| Free to use | ✅ | ✅ confirmed (freeware) |
| Open source (MIT) | ✅ | ❌ confirmed (closed source, abandoned) |
| Community-driven | ✅ GitHub PRs + issues | ❌ confirmed (single vendor, now inactive) |
| Shareable design links (URL) | ✅ hash-encoded state | ❌ confirmed |
| Auto-saves state between sessions | ✅ localStorage | ⚠ project files only |

---

## Box types & simulation models

| Feature | Resonate | WinISD |
|---|---|---|
| Sealed (closed) | ✅ | ✅ confirmed |
| Vented (bass-reflex) | ✅ | ✅ confirmed |
| 4th-order bandpass | ✅ | ✅ confirmed |
| 6th-order bandpass (both chambers ported) | 🚧 | ⚠ assumed yes |
| Passive radiator | ✅ | ✅ confirmed |
| Isobaric / compound loading | 🚧 | ⚠ assumed yes |
| Multiple drivers (series / parallel wiring) | ✅ | ✅ confirmed |
| Box loss model (Ql leakage, Qa absorption) | ✅ default Ql=10, Qa=100 | ✅ confirmed — same defaults (WinISD help file + direct observation) |
| WinISD-compatible circuit model | ✅ (default mode) | ✅ confirmed |
| Full gyrator (frequency-dependent Le) | ✅ switchable | ❌ confirmed — Le excluded from WinISD's acoustic circuit |

---

## Simulation curves

| Feature | Resonate | WinISD |
|---|---|---|
| SPL (sound pressure level) | ✅ | ✅ confirmed |
| Driver excursion (Xmax) | ✅ | ✅ confirmed |
| PR excursion | ✅ | ⚠ assumed |
| Port air velocity | ✅ | ⚠ assumed |
| Impedance magnitude | ✅ | ✅ confirmed |
| Impedance phase | ✅ | ⚠ assumed |
| Group delay | ✅ | ✅ confirmed |
| Transfer phase | ✅ | ⚠ assumed |
| Max SPL curve (excursion-limited) | ✅ | ⚠ assumed |
| Max power curve (thermal-limited) | ✅ | ⚠ assumed |
| Compare / overlay multiple designs | ✅ pin + overlay | ❌ confirmed (section 9 WINISD.md) |
| Cursor with frequency / value readout | ✅ | ⚠ assumed |
| Cursor peak snap | ✅ right-click snap | ❌ confirmed |
| Cursor lock and nudge | ✅ | ❌ assumed |

---

## Signal chain & drive conditions

| Feature | Resonate | WinISD |
|---|---|---|
| Drive voltage (2.83 V IEC reference) | ✅ | ✅ confirmed — `Eg = sqrt(P × Re)` |
| Arbitrary input power / voltage | ✅ | ✅ confirmed |
| Series source resistance (Rs) | ✅ | ✅ confirmed |
| High-pass filter | ✅ | ⚠ assumed |
| Low-pass filter | ✅ | ⚠ assumed |
| Linkwitz–Riley transform | ✅ | ⚠ assumed |
| Parametric EQ (peaking) | ✅ | ⚠ assumed limited |
| Multiple filters in a chain | ✅ | ⚠ assumed limited |

---

## Alignment & design tools

| Feature | Resonate | WinISD |
|---|---|---|
| EBP (Efficiency Bandwidth Product) gauge | ✅ | ⚠ assumed |
| Butterworth (Qtc = 0.707) sealed auto-Vb | ✅ | ⚠ assumed |
| QB3 / B4 vented auto-align | ✅ | ✅ confirmed |
| Vent ↔ tuning frequency solver | ✅ | ⚠ assumed |
| PR mass auto-tune to target Fp | ✅ | ⚠ assumed |
| Key stats readout (F3, Qtc, Fb/Fp, peak Z) | ✅ StatBar | ⚠ assumed |
| Baffle-step / diffraction correction | 🚧 | ⚠ assumed |
| Step response (inverse FFT) | 🚧 | ⚠ assumed |

---

## Driver & PR management

| Feature | Resonate | WinISD |
|---|---|---|
| Built-in driver library (search / browse) | ✅ JSON, extensible | ✅ confirmed (.wdr database) |
| Import driver from file | ✅ .wdr | ✅ confirmed |
| Export driver to file | ✅ .wdr | ✅ confirmed |
| Community driver contributions | ✅ GitHub PR | ❌ confirmed (abandoned project) |
| PR library (save / recall) | ✅ localStorage | ⚠ assumed limited |
| Edit T/S parameters in-app | ✅ | ✅ confirmed |

---

## File formats

| Feature | Resonate | WinISD |
|---|---|---|
| WinISD `.wdr` driver import | ✅ | ✅ native |
| WinISD `.wdr` driver export | ✅ | ✅ native |
| WinISD `.wpr` project import | 🚧 (binary format; needs reverse-engineering) | ✅ native |
| JSON project save / load | ✅ | ❌ |
| Shareable URL (full state encoded) | ✅ | ❌ |

---

## Engineering quality & testing

| Feature | Resonate | WinISD |
|---|---|---|
| Physics validated against closed-form equations | ✅ < 0.03 dB error | ❌ (closed source, unknown) |
| Automated unit tests (physics core) | ✅ node:test, human-readable BDD scenarios | ❌ |
| Golden-master regression tests (6 designs) | ✅ | ❌ |
| Browser integration tests (Playwright) | ✅ | ❌ |
| Runtime self-test on page load | ✅ (console output) | ❌ |
| Continuous integration (GitHub Actions) | ✅ | ❌ |
| Pure-function physics core (DOM-free, testable in Node) | ✅ | ❌ (GUI-coupled) |
| Citable references for every formula | ✅ JAES, Wikipedia, WinISD help | ❌ |

---

## Planned but not yet implemented (Resonate todo)

Items not in the table above, roughly in priority order.
See [BACKLOG.md](BACKLOG.md) to claim one or discuss prioritisation.

| Feature | Notes |
|---|---|
| 6th-order bandpass | Good first issue — template already exists as 4th-order |
| Isobaric / compound loading | Good first issue — acoustic circuit extension |
| Baffle-step / diffraction correction | Well-understood model; needs a curve and a UI toggle |
| Step response curve | Inverse FFT of transfer function; rendering work only |
| `.wpr` WinISD project import | Lazarus binary component stream; needs a sample file |
| Mobile / small-screen layout | Responsive CSS pass; no new physics |
| Measurement import (REW `.mdat`, FRD) | Would allow measured response overlay alongside simulation |
| Impedance measurement → T/S extraction | Closed-box or added-mass method; valuable for DIY builders |
| Multi-way SPL summation (with crossovers) | Large feature; needs crossover design first |
| Crossover design | Out of scope for v1; see VituixCAD for now |
| Polar response / directivity | Out of scope for v1 |

---

*Comparison accurate as of 2026-06-24. WinISD version observed: 0.7.0.950.
WinISD confirmation sources: official help files extracted from 0.7 installer,
direct UI observation, and community reports. See [WINISD.md](WINISD.md) for full citations.*
