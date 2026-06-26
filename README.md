# Welcome to Resonate 

Resonate is a currently "shitty" (not my words) vibe coded spike based on the functionality offered by WinIsd.

WinIsd has been abandoned and is closed source so there is no opportunity to move it forward.

The intention of Resonate is to form a collaboration of interested parties to build a modern alternative to WinIsd.

The technical goals include compatibility with WinIsd file formats (and other) and to create a modern intuitive tool that address the numerous complaints on the internet about the WinIsd tool.

The long term goals of Resonate are to build something open source using modern tech and with proper tests and architecture so that it doesn't rot when I drop dead or lose interest, ie to make this not shitty.

**I am looking for a band of the willing to move this thing forward.**

Please volunteer your time with ideas and feedback and pull requests for improving it.


## Who am I?

I am a software engineer with 40 years of experience and would like to do the right thing here and have a bit of fun at the same time.

My bio, CV and all my Hackaday projects can be found on my personal page https://johnlon.github.io/

But I need your help; that's the whole point!

# Resonate

**An open, community-owned loudspeaker enclosure simulator that runs in any browser.**

*Speaker design belongs to everyone who builds.*

Resonate is a modern, free, open-source replacement for WinISD — a tool to design
sealed, vented, bandpass, and passive-radiator enclosures from a driver's
Thiele/Small parameters. No install, no licence key, runs in any browser.
Validated against the closed-form physics, with a self-test that proves it
on every load.

> ## ▶ [**Launch Resonate**](https://johnlon.github.io/resonate/)
>
> Runs in your browser — nothing to install if you don't want to.
> Mobile layout is a known gap — contributions welcome.
>
> **To install for offline use (PWA):**
> - **Chrome / Edge / Android:** open the site, click the install icon in the address bar (or the ⋮ menu → "Install Resonate")
> - **iOS Safari:** tap the Share button → "Add to Home Screen"
>
> Once installed the app works without an internet connection.

---

## Why

The speaker-design tool landscape is a graveyard. WinISD has been abandoned since
2016 and is Windows-only. Basta, Unibox, the old spreadsheets — fragmented and
dead. The web calculators that filled the gap mostly can't be trusted at the
frequencies that matter.

The Thiele/Small math has been public since the 1970s. The knowledge is open; the
tools are not. Resonate exists to close that gap, and to do it **once, together**,
instead of as another solo project that dies in a year.

## What it does

- **Box types:** sealed, vented (bass-reflex), 4th-order bandpass, passive radiator
- **Curves:** SPL, driver + PR cone excursion, port air velocity, group delay,
  impedance magnitude & phase, transfer-function phase, max SPL, max power
- **Design aids:** EBP box-type gauge, Qtc / QB3-B4 alignment helpers, vent
  length ↔ tuning solver, passive-radiator Fp tuning + mass auto-tune,
  multiple drivers (series / parallel)
- **Files:** import **and** export WinISD `.wdr` driver files; save/load whole
  projects as JSON

## Resonate vs WinISD

WinISD is the canonical reference tool. Resonate's default mode replicates its
simulation output. But Resonate goes further in several areas:

| | WinISD 0.7 | Resonate |
|---|---|---|
| **Platform** | Windows-only desktop app | Any browser, no install |
| **Source** | Closed, abandoned 2016 | Open source, MIT licence |
| **Circuit model** | Simplified acoustic-domain only (Le excluded from SPL/GD) | Both WinISD-compatible **and** full gyrator with Le (switchable) |
| **Box losses** | Ql + Qa via hidden "Advanced→" popup | Ql + Qa with practical stuffing guide |
| **Cursor / readout** | Mouse hover only | Hover + right-click snap to peak/trough + lock + Hz input |
| **Design compare** | Not supported | Pin any design, overlay curves |
| **State persistence** | Manual project files | Auto-saves to browser storage |
| **Filter / EQ** | Yes | Yes |
| **Passive radiator** | WinISD-style inputs | WinISD **and** T/S modes, switchable |

### Why the circuit model switch matters

WinISD computes SPL and group delay using a simplified acoustic-domain model where voice-coil
inductance (Le) does not affect the simulation — only the impedance plot. Resonate defaults to
this mode so cross-checks against WinISD are exact.

The **Full gyrator** mode includes Le throughout: the driver's electrical back-impedance becomes
frequency-dependent, which is physically correct and matters when Le is large (>1 mH) or when
accuracy above a few hundred Hz is needed. Group delay peak frequency shifts by ~2 Hz in the
demo driver (Le = 0.7 mH) — a real physical difference, not a bug in either tool.

Switch between modes in the **Signal & drivers** panel → Circuit model.

## Trust, not vibes

Every model is validated against the exact closed-form solutions:

- the sealed box reproduces `fc = Fs·√(1+Vas/Vb)`, `Qtc = Qts·√(1+Vas/Vb)` to
  **< 0.03 dB**
- the passband asymptotes to the driver's reference sensitivity
- the vented box rolls off at 24 dB/oct with two impedance peaks straddling Fb

The app runs these as a self-test in your browser console on load, and they run in
CI from `test/engine.test.mjs`. If the physics is wrong, the test goes red — in
public. See [CONTRIBUTING.md](CONTRIBUTING.md) for the model.

## Run it

- **Hosted:** <https://johnlon.github.io/resonate/> — nothing to install
- **PWA / offline:** see the install instructions in the callout above
- **Local dev:** `npm install && npm run dev` — opens at `http://localhost:5173`
- **Build:** `npm run build` — output goes to `dist/`, serve with any static host

## Driver library

`drivers/` holds community-contributed `.wdr` files. Got a driver Resonate
doesn't? Import its spec sheet, check the numbers, and open a PR with the `.wdr`.
Every spec sheet added is a gift to the next builder — this shared library is the
whole point.

## Contributing

Newcomers welcome — you do not need to be an acoustician. The physics engine lives
in `src/core/`; a new box type or filter is a weekend and a pull request. Start
with [CONTRIBUTING.md](CONTRIBUTING.md) and the [backlog](BACKLOG.md).

## Free?

Yes. The entire app runs in your browser — there is no backend, no server, no
account. The physics engine is client-side JavaScript; your designs never leave
your machine unless you choose to share them.

The intention is to keep it that way for as long as it's feasible. Any feature
that genuinely required a backend would be a large, explicit architectural
decision — not a default direction. The goal is that as much of the app's functionality remains free as long as
that's feasible. If a backend turns out to be necessary for something, that's
a decision for the community to make together. The source is MIT-licensed; if the maintainers vanish, fork it and
carry on.

## License

MIT — forever. See [LICENSE](LICENSE). Resonate can never be closed up, taken
away, or left behind a login. If the maintainers vanish, fork it and carry on.
