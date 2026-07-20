# References & prior art

External resources for OpenISD's engine and tests. Two uses: **theory** (what
the math should be) and **oracles** (known-good values to test against).

> Using these for reference is fine — reading equations and theory, and
> _cross-checking outputs_, carries no licence issue. Do **not** copy code from
> GPL/closed projects into OpenISD; cite them as reference and re-derive.

---

## 1. Theory canon — what our engine implements

OpenISD uses the **analogous-circuit (acoustical impedance analogy)** model with
controlled sources coupling the electrical → mechanical → acoustical domains. The
authoritative sources for exactly this approach:

- **W. Marshall Leach Jr — _Introduction to Electroacoustics & Audio Amplifier
  Design._** Dedicated chapters on analogous circuits, closed-box and vented-box
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
  (B2 / QB4 / B4 / C4). Closest peer to OpenISD.
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
- **Action: confirm the actual numbers against a _primary_ source — Small's JAES
  paper or Dickason's _Loudspeaker Design Cookbook_ — not a web snippet.** e.g. the
  commonly-quoted B4 anchor "Qts ≈ 0.4048, Fb/Fs = F3/Fs = 1 at Ql = 7" must be
  verified before it becomes a test assertion.
- Collections to check against (then trace to primary): Leach vented-box PDF (§1);
  DIY Loudspeaker Design alignment tables
  <https://sites.google.com/site/diyloudspeakerdesign/home/box-design/alignments/alignment-tables>.

**Tier 4 — cross-tool agreement (sanity only).** scimpy / Vented outputs (§2).

**Box types without a clean closed form (PR, bandpass):** pin with the _physical
sanity oracles_ already established this session, not a single magic number:

- output volume velocity → 0 as ω→0 (no DC reinforcement),
- low-end rolloff ≈ 24 dB/oct (vented/PR) / bandpass shape,
- two impedance peaks straddling Fb (vented), Fp between peaks (PR).
  The plan should state explicitly that these modules are **less tightly pinned**
  than sealed/vented.

---

## 4. Web-based design tools & cross-check oracles

Comparable end-user enclosure/design tools — used as cross-check oracles and as
prior-art reference for features. Detailed per-tool findings (fields, automation
notes, gaps) live in `FEATURE_COMPARISON.md` (§"Merged from OTHER_TOOLS.md"); this is the reference index.

- **WinISD** — the desktop incumbent OpenISD emulates; `.wdr` file format is our
  interchange baseline. <http://www.linearteam.org/> · see `WINISD.md`.
- **micka.de** — sealed + vented cross-check oracle (`#ideal` calculator; no
  PR/bandpass). <https://www.micka.de/en/index.php> · see `FEATURE_COMPARISON.md` (§"Merged from OTHER_TOOLS.md") §2/§6 and
  `archive/PLAN_SBL_CROSSCHECK.md`.
- **SpeakerBoxLite** — second oracle covering PR + bandpass.
  <https://speakerboxlite.com/subwoofer-box-calculator/> · see `FEATURE_COMPARISON.md` (§"Merged from OTHER_TOOLS.md") §3.
- **SpeakerDesign.dev** — free browser toolkit self-billed as a "web-based WinISD
  alternative" (box sim + cutlist + 3D). <https://speakerdesign.dev/> · see
  `FEATURE_COMPARISON.md` (§"Merged from OTHER_TOOLS.md") §4.
- **Sonella** — guided DIY full-range design app (Dayton drivers, crossover, STL
  export). <https://sonella.app/> · see `FEATURE_COMPARISON.md` (§"Merged from OTHER_TOOLS.md") §5.
- **00 Audio Simulator** — closest web competitor; imports `.wdr`, covers
  sealed/vented/bandpass/PR, adds port velocity + on-graph EQ + share links.
  <https://simulator.00aud.io/> · see `FEATURE_COMPARISON.md` (§"Merged from OTHER_TOOLS.md") §6.
- **SoundForm** — closed-beta web WinISD app (crossover + multi-driver summation focus);
  no public URL, access by author DM.
  <https://www.reddit.com/r/diyaudio/comments/1snqre1/new_features_for_web_based_winisd_app/>
  · see `FEATURE_COMPARISON.md` (§"Merged from OTHER_TOOLS.md") §7.
- **LoudspeakerLab** — automated passive-crossover + system solver (ABCD-matrix model,
  multi-objective search) on a measurement-based CTA-2034A public driver commons (FRD/ZMA
  uploads); sealed/vented box modelling is a sub-component. Interchange is FRD/ZMA + SPICE
  netlist, not `.wdr` — not a cross-check oracle. <https://loudspeakerlab.io/>
  · see `FEATURE_COMPARISON.md` (§"Merged from OTHER_TOOLS.md") §8.

---

## 5. Driver data sources (for the library, not the engine)

- loudspeakerdatabase.com — per-driver export to WinISD `.wdr` (and other tools);
  no public API. Already the de-facto `.wdr` source.
  **Search tip:** Google `site:loudspeakerdatabase.com <model name>` to find a driver's
  page directly, e.g. `site:loudspeakerdatabase.com RS180-8`. The database has no
  programmatic search but Google indexes it well.
- Federated repos via `drivers/sources.json` (e.g. MWisBest/WinISDDrivers).
- **Parts Express product search API** — full field map, unit conversions,
  example responses, and refresh workflow now live in the sibling `winisd_tools`
  repo's `VENDOR-APIS.md` ("Parts Express product search API — detailed notes").
