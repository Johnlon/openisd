# Where WinISD's `c`/`roo` come from — provenance, history, and the half transition

**One place for everything on this question.** Every other document that touches
`c`/`roo` provenance should state nothing of its own and point here.

---

## 1. The settled rule (machine-verified against real WinISD)

A driver's `c` (speed of sound) and `roo` (air density) in WinISD are **always computed,
never stored constants**:

- **`c` is ideal-gas moist mixing** of the **app-level Options environment**
  (`c = sqrt(1.4·R·T/M)`, Hyland–Wexler vapour pressure, molar-mass mixing, no
  enhancement factor). Cross-validated at the two temperatures NOT in the fit:
  1.3e-7 relative at 313.15 K, 2.0e-8 at 273.15 K.
- **`roo` is derived from `c`**: `roo = 1.4·p/c²`, holding to 1.3e-15..2.6e-15 across
  all probe environments — double-precision equality, never an independent quantity.
- **The only environment that ever reaches them is the app-level Options dialog**
  (T/RH/AP persisted in WinISD's own `settings.ini`, not in the `.wpr`).
  Machine-verified: `docs/design/WINISD_SCHEMA.md` §12/§13.
- **The project-level `[Box]` environment (T/RH/phi) is dead for air.** WinISD writes
  it into every project, shows readouts from it on the Project tab, and **never reads
  it for `c`/`roo`** — confirmed inert across all probes. The `env-t-303`/`env-rh-30`
  parity goldens' byte-identical `c`/`roo` are explained by exactly this: those
  scenarios vary the `[Box]` env, which WinISD never reads.

Evidence: ledger QO93 (questions.yml, 2026-08-27, ANSWERED BY EXPERIMENT);
`winisd_research/PROBE_FINDINGS.md` FINDING-008; data `runs/qo93_air_output/results.jsonl`
(six controlled environments written to `settings.ini` before launch, outputs read from
the saved `.wpr` at 15 significant digits). Provenance rule: `PROBE_METHOD.md`
"PROVENANCE" — measured, not assumed.

## 2. The history: an incomplete migration ("half transition")

**Builds.** WinISD Pro ALPHA (©1996–2004, the commercial predecessor) vs WinISD Pro
0.7.0.950 (the Linearteam continuation this project targets).

- **Alpha** (`docs/research/WINISD_PARITY.md` §20, evidence in
  `docs/samples/legacy_winisd_pro_alpha/`): there is no global Options dialog. The live
  environment control sits on a per-chart-window **"Plot" tab**. On save, its computed
  pair is written verbatim into the **`[Driver]`** section of the `.wpr`
  (`c=343.68`, `roo=1.20095`), while the project's `[Box]` section carries its own
  T/p/phi **and no `c`/`roo` fields at all**.
- **0.7.0.950**: the live control moved to the global **Options** dialog, but the shape
  is the same — a driver's blank `c`/`roo` resolve from it at load/creation, and the
  driver record then holds a snapshot of that live compute; the project-level
  environment field was carried forward unchanged and **still never wired to anything**.

**Conclusion** (recorded in WINISD_PARITY §20): the live control's location moved across
versions while the project-level field was never wired up in either build — an
**incomplete migration**, not two deliberate designs.

Caveat kept from §20: the Alpha finding rests on one screenshot and one saved file
(single-sample). A multi-cell probe would be needed before treating every branch of the
Alpha build's resolution rule as settled.

## 3. John's recollection, checked against the evidence (2026-10-02)

John, from memory: *"`c`/`roo` used to be project settings in an earlier version and not
in the driver; in Pro they moved into the driver, but one or the other isn't used at all
— obviously the project-level values should be used. The driver values are junk IIRC in
WinISD?"*

| Claim | Verdict |
| --- | --- |
| One of the two isn't used at all | ✅ **Confirmed** — the project-level `[Box]` env is dead for air in both builds. |
| It's an incomplete migration | ✅ **Confirmed** — the "half transition" reading above. |
| `c`/`roo` used to be *project* settings in an earlier version | ❌ **No evidence.** In the Alpha they already went into the `[Driver]` section; the project slot never carried `c`/`roo` in either build. (Single-sample caveat.) |
| The driver-record values are junk | ❌ **Refuted.** They are the live app-level compute at solve/save time (QO93: `c` = moist mixing, `roo` = 1.4·p/c², validated to 1e-7 away from the fit point). What is dead is the **project-level** environment — the other half of the same memory. |

The design opinion "the project-level values *should* be used" is a fair reading of
intent — but WinISD demonstrably does not do that, and OpenISD's parity contract
(QO93 → QO95) is to mimic WinISD's actual wiring unless WinISD is measurably wrong.
Making a project env authoritative would be a deliberate divergence and needs a human
ruling before implementation.

## 4. What OpenISD does

- `packages/design/engine/air.ts` `winisdAir(tempK, humidityPct, pressurePa)` implements
  the measured model exactly (Hyland–Wexler, moist mixing, `ρ = γ·p/c²`); it reproduces
  all six probed environments to ≤ 2.5e-15 relative (`air.test.ts` pins every row).
- `useWinisdAirModel` defaults to **true** (QO95, reversing QO7): a new project matches
  WinISD out of the box. The physical CIPM-2007 model remains the alternative; the two
  are a physics/parity pair, not right/wrong.
- There is **no frozen ρ/c constant anywhere** — not in WinISD, not here. The module
  docstring in `air.ts` states this; `docs/spec/SPEC_ENGINE.md` §4.2 pins it.
- OpenISD's per-project environment is the stand-in for the environment WinISD reads
  (its app-level one): OpenISD has no app-level env, so the project env is what the
  engine consumes. It is *used*, unlike WinISD's `[Box]` env — the deliberate difference.
