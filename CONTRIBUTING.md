# Contributing to OpenISD

You do not need to be an acoustician. If you can edit a Vue component or open a pull request, you
can contribute.

## Quick start

Read `ARCHITECTURE.md` and the Quality gates section of `AGENTS.md`, then:

```bash
npm install && bash scripts/health-check.sh
```

Pick work from `BACKLOG.md`; P0 gates everything else.

## Rules that catch people out

- Never hand-edit driver data under `drivers/` — it is produced by `winisd_tools` and lands here
  as records. A wrong value is fixed at the source.
- `drivers/matt/` is human-curated and off-limits to any script or agent.
- Only a human sets `reviewed_by` or any "human-verified" field.
- Calculation logic — formulas, physical constants, display precision, defaults affecting a
  result — changes only with explicit maintainer approval.

## Who owns what

| Concern | Human | Agent | Tooling |
| --- | --- | --- | --- |
| What to build (`BACKLOG.md`) | Decides | Suggests | — |
| Physics & calculation correctness | Decides | Implements | Cross-check (reference) |
| `packages/engine/src/` formulas & constants | Approves | Proposes | Unit + oracle tests |
| Driver data (`drivers/**`) | Authorises | Reads only | winisd_tools writes |
| `drivers/matt/` | Owns | Excludes | Excludes |
| `reviewed_by` / "human-verified" | Only | Never sets | — |
| Tests | Reviews | Writes | Runs (CI) |
| Commits & merges | Authorises | Drafts message | — |

## How the engine works

A lumped-element electro-mechano-acoustical circuit solved in the acoustical impedance analogy,
one complex value per frequency (`packages/engine/src/sweep.ts`, `circuit.ts`). `eg` is RMS, so
SPL is RMS-referenced; excursion and port velocity are peak (×√2) against Xmax and chuffing
limits. For a vented or PR box, net radiated volume velocity is `U_0 = U_D − U_port`; that minus
sign is what produces the 24 dB/oct rolloff.

Layer diagram: `ARCHITECTURE.md` AD-6. Formulas with test citations: `docs/spec/SPEC_ENGINE.md`.

## Pull requests

Keep changes focused; describe what and why. If it touches the engine, paste the test output. By
contributing you agree your work is released under the project's MIT license.
