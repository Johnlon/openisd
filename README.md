# Welcome to Resonate 

Resonate is a currently "shitty" vibe coded spike based on the functionality offered by WinIsd.

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
Thiele/Small parameters. No install, no licence key, runs on a phone. One HTML
file. Validated against the closed-form physics, with a self-test that proves it
on every load.

> ## ▶ [**Launch Resonate**](https://johnlon.github.io/resonate/)
> DOES NOT WORK on phone yet - this was literally 4 hours of hacking.
> 
> Runs in your browser — nothing to install.
> Also works offline: download
> `index.html` and open it directly. Help build the mobile version.

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

It's a single static file. Any of these work:

- **Hosted:** <https://johnlon.github.io/resonate/> — nothing to install, or
- **Offline:** download `index.html` and open it directly in a browser, or
- **Local server:** `python -m http.server` then visit `http://localhost:8000`.

No build step, no dependencies, no toolchain.

## Driver library

`drivers/` holds community-contributed `.wdr` files. Got a driver Resonate
doesn't? Import its spec sheet, check the numbers, and open a PR with the `.wdr`.
Every spec sheet added is a gift to the next builder — this shared library is the
whole point.

## Contributing

Newcomers welcome — you do not need to be an acoustician. The engine is plain
JavaScript in one file with no build step; a new box type or filter is a weekend
and a pull request. Start with [CONTRIBUTING.md](CONTRIBUTING.md) and the
[roadmap](ROADMAP.md).

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
