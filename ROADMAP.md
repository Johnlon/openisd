# Roadmap

Resonate is community-owned — this roadmap is a starting point, not a decree.
Open an issue to propose, claim, or reshape anything here.

## Done

- Validated engine: sealed, vented, 4th-order bandpass, passive radiator
- Curves: SPL, driver + PR excursion, port velocity, group delay, impedance
  (mag + phase), transfer phase, max SPL, max power
- EBP gauge, Qtc / QB3-B4 alignment helpers, vent ↔ tuning solver
- Passive-radiator Fp tuning + mass auto-tune
- Multiple drivers (series / parallel)
- WinISD `.wdr` import **and** export; JSON project save/load
- In-browser self-test + CI engine test

## Next

- **Publish** to GitHub Pages so there's one shareable URL
- **Shareable designs** — URL-encode project state so a design is a link you can
  paste into a forum
- **Open driver database** — grow `drivers/`, plus a simple in-app browser/search
- Mobile / small-screen layout pass

## Help wanted — good first issues

These are self-contained and slot into the existing engine cleanly:

- **6th-order bandpass** — both chambers ported (the 4th-order single-port case
  already exists as a template)
- **Iso-baric / compound** loading
- **Filter / EQ chain** — high-pass, low-pass, Linkwitz transform, parametric EQ,
  gain, applied to the complex transfer function (the curves are already complex)
- **Baffle-step / diffraction** correction
- **Step response** curve (inverse FFT of the transfer function)
- **More `.wdr` drivers** — no code needed, just verified spec data
- **Additional file formats** — e.g. read other tools' driver exports

## Big rocks (discuss first)

- `.wpr` WinISD project import — WinISD writes these as a Lazarus binary component
  stream, so this needs a sample file and some reverse-engineering
- Plugin/extension points so box types and filters can be contributed
  independently
- A driver-data contribution + verification workflow at scale
