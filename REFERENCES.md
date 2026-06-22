# References & prior art

External resources for Resonate's engine and tests. Two uses: **theory** (what
the math should be) and **oracles** (known-good values to test against).

> Using these for reference is fine — reading equations and theory, and
> *cross-checking outputs*, carries no licence issue. Do **not** copy code from
> GPL/closed projects into Resonate; cite them as reference and re-derive.

---

## 1. Theory canon — what our engine implements

Resonate uses the **analogous-circuit (acoustical impedance analogy)** model with
controlled sources coupling the electrical → mechanical → acoustical domains. The
authoritative sources for exactly this approach:

- **W. Marshall Leach Jr — *Introduction to Electroacoustics & Audio Amplifier
  Design.*** Dedicated chapters on analogous circuits, closed-box and vented-box
  systems, acoustic impedance and pressure transfer functions. This is the closest
  textbook match to our `circuit`/`sweep` model.
  Legacy course material: <https://leachlegacy.ece.gatech.edu/audiotext/>
- **Leach — "Electroacoustic Design with SPICE", JAES Vol. 39 No. 7/8 (1991).**
  The vented-box loudspeaker as a SPICE circuit — directly comparable to our
  per-frequency solve.
- **Vented-box design notes (Leach, Georgia Tech):**
  <https://leachlegacy.ece.gatech.edu/ece4445/downloads/ventedbox.pdf>
- **A. N. Thiele (1971) and R. H. Small (1972–73) — the original JAES papers**
  on closed-box and vented-box systems and their alignments. The primary source
  for the alignment tables (see §3).
- **Klippel — small-signal lumped parameters** (parameter definitions):
  <https://www.klippel.de/know-how/measurements/transducer-parameters/small-signal-lumped-parameters.html>
- **Thiele/Small parameters — Wikipedia** (quick formula reference):
  <https://en.wikipedia.org/wiki/Thiele/Small_parameters>

---

## 2. Open-source implementations — cross-check / sanity only

Useful to compare curve shapes and catch gross errors. **Agreement ≠ correctness**
— these are sanity checks, not ground truth.

- **scimpy** (Python) — sealed + vented SPL and group delay, alignment optimisation
  (B2 / QB4 / B4 / C4). Closest peer to Resonate.
  <https://github.com/maqifrnswa/scimpy>
- **jmpolom/Vented** (Python) — vented-box frequency response from the Thiele &
  Small papers. <https://github.com/jmpolom/Vented>
- **be1/qspeakers** (C++/Qt) — enclosure designer with volume optimisation.
  <https://github.com/be1/qspeakers>
- **srjh/speaker-driver-parameters** (Python) — T/S extraction from a measurement.
  <https://github.com/srjh/speaker-driver-parameters>

---

## 3. Test oracles — tiered by trustworthiness

A wrong baseline institutionalises a bug, so rank fixtures by provenance:

**Tier 1 — closed forms (exact, self-evident).** Already in use:
- Sealed: `fc = Fs·√(1+Vas/Vb)`, `Qtc = Qts·√(1+Vas/Vb)`; |G|² closed form.
- Passband asymptotes to reference sensitivity.

**Tier 2 — manufacturer datasheets (trustworthy).**
- **Tang Band W6-1139SIF** datasheet is a ready-made, internally-consistent
  `driver`-module fixture (Fs 35, Qts 0.40, Qes 0.47, Vas 11.78 L, Sd 0.0140 m²,
  Bl 8.47, Xmax 11.5 mm, Re 3.6, Mms 39.91 g, Cms 598.98 µm/N). Add more.

**Tier 3 — alignment tables (verify before enshrining).**
- Vented alignment families (B4, QB3, SBB4, C4, Bessel, Chebyshev): Fb/Fs, Vb/Vas,
  F3/Fs vs Qts.
- **Action: confirm the actual numbers against a *primary* source — Small's JAES
  paper or Dickason's *Loudspeaker Design Cookbook* — not a web snippet.** e.g. the
  commonly-quoted B4 anchor "Qts ≈ 0.4048, Fb/Fs = F3/Fs = 1 at Ql = 7" must be
  verified before it becomes a test assertion.
- Collections to check against (then trace to primary): Leach vented-box PDF (§1);
  DIY Loudspeaker Design alignment tables
  <https://sites.google.com/site/diyloudspeakerdesign/home/box-design/alignments/alignment-tables>.

**Tier 4 — cross-tool agreement (sanity only).** scimpy / Vented outputs (§2).

**Box types without a clean closed form (PR, bandpass):** pin with the *physical
sanity oracles* already established this session, not a single magic number:
- output volume velocity → 0 as ω→0 (no DC reinforcement),
- low-end rolloff ≈ 24 dB/oct (vented/PR) / bandpass shape,
- two impedance peaks straddling Fb (vented), Fp between peaks (PR).
The plan should state explicitly that these modules are **less tightly pinned**
than sealed/vented.

---

## 4. Driver data sources (for the library, not the engine)
- loudspeakerdatabase.com — per-driver export to WinISD `.wdr` (and other tools);
  no public API. Already the de-facto `.wdr` source.
- Federated repos via `drivers/sources.json` (e.g. MWisBest/WinISDDrivers).
