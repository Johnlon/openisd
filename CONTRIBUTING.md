# Contributing to Resonate

Welcome. You do **not** need to be an acoustician to help here. If you can edit an
HTML file and open a pull request, you can contribute.

## The one rule: don't break the physics

Resonate's whole value is that its numbers are trustworthy. So:

```
npm test
```

must stay green. It runs the engine validation gates against the closed-form
Thiele/Small solutions. Run it before you push. If you add a box type or curve,
add a check for it.

## Project shape

- **`src/core/`** — the physics engine, alignments, `.wdr` I/O, state. Pure JS,
  no DOM. This is the reusable heart of the project.
- **`src/components/`** — Vue 3 UI components (graphs, panels, controls).
- **`test/`** — engine unit tests (`engine.test.mjs`) and Playwright browser tests.
- **`drivers/`** — community `.wdr` driver files.

To run locally: `npm install && npm run dev`

## How the engine works

It's a lumped-element electro-mechano-acoustical circuit solved in the
**acoustical impedance analogy**, one complex value per frequency. The core lives
in `solve(f, drv, box, P)`:

```
p_g  = e_g·Bl / (Sd·Zcoil)            // pressure generator
Z_aE = Bl² / (Sd²·Zcoil)              // reflected electrical impedance
Z_aD = Rms/Sd² + jω·Mms/Sd² + 1/(jω·Cms·Sd²)   // driver, acoustical side
```

The box adds a load `Z_box` (compliance `Cab = Vb/ρc²`, leakage from `Ql`, plus a
port / passive-radiator branch). Then:

```
U_D = p_g / (Z_aE + Z_aD + Z_box)     // diaphragm volume velocity
U_0 = U_D − U_port                    // net radiated (sign matters: → 0 at DC)
SPL = 20·log10( ρω·|U_0| / (2πr) / 20e-6 )   // half-space, 1 m
```

A few conventions worth knowing before you touch it:

- `eg` is **RMS**, so SPL is RMS-referenced. Excursion and port velocity are
  reported as **peak** (×√2) to compare against Xmax and chuffing limits.
- For a vented/PR box, `U_0 = U_D − U_port`. The minus sign is load-bearing — it's
  what gives the 24 dB/oct rolloff. The test checks it; don't "simplify" it away.
- Driver T/S are made internally self-consistent on import. Scraped `.wdr` files
  often aren't (their stored Bl/Mms disagree with Fs/Qes/Vas).

## Adding a box type

1. Add a branch in `solve()` that builds `Z_box`, `U_D`, `U_P`, `U_0`, and `Zel`.
2. Add it to the box-type `<select>` and any type-specific input fields.
3. Add a check to `test/engine.test.mjs` — at minimum, a sanity on the rolloff and
   impedance peaks.

The 4th-order bandpass branch is a good worked example of a two-chamber load.

## Adding a driver (`.wdr`)

No code required. Import the spec sheet in the app, sanity-check the curves,
export the `.wdr`, and drop it in `drivers/` with a clear filename. Note your
source in the PR.

## Pull requests

- Keep changes focused; describe what and why.
- If it touches the engine, paste the test output.
- Be kind in review. This is a workshop, not a courtroom.

By contributing you agree your work is released under the project's MIT license.
