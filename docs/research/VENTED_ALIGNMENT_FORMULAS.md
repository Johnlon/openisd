# Vented alignment formulas — QB3, BB4/SBB4, C4/SC4, EBS3, EBS6

WinISD's New Project wizard offers 5 vented alignments. OpenISD's `ventedAlignment()`
([boxDesign.ts](http://localhost:8000/winisd/openisd/packages/design/engine/boxDesign.ts#L149))
implements all 5 with WinISD's own formulas (wired 2026-09-22, John's "option 1"); the engine
test [vented-alignment.test.ts](http://localhost:8000/winisd/openisd/packages/design/test/engine/vented-alignment.test.ts)
holds every capture below to 1e-12. Plan: [`archive/FIX_WIZARD_VENTED.md`](../plans/archive/FIX_WIZARD_VENTED.md?html); remainder: [`FIX_WIZARD_VENTED-remains.md`](../plans/FIX_WIZARD_VENTED-remains.md?html).

**Confidence markers** (as [`WINISD_PARITY.md`](WINISD_PARITY.md?html)):
✅ sourced from WinISD itself · 🟡 third-party derivation, named/citable · ❌ not found.

**Status 2026-09-22: all 5 are ✅.** The designer function was decompiled from `winisd.exe`
(`winisd_research/GHIDRA_FINDINGS.md`, "VENTED ALIGNMENT MECHANISM FOUND — `0x46afd0`") and
reproduces all 60 captured wizard runs (Qts 0.15–1.0) to ≤ 2.3e-14 relative error
(`winisd_research/toys/validate_vented_alignment_formulas.py`,
output `winisd_research/runs/vented_alignment_validation.md`).

---

## 1. The mechanism (all 5 alignments)

```
Qes' = Qes · (Re + Rg) / Re          # Rg = project signal-source resistance ([SignalSource] Rg)
Qts' = 1 / (1/Qes' + 1/Qms)

BB4/SBB4:               alpha = ¼ · (1/Qts' − 1/Ql)²        h = 1
QB3, EBS3, EBS6, C4/SC4: x = ln(Qts')
                        alpha = exp(P_alpha(x))              h = exp(P_h(x))

Vb = Vas / alpha
Fb = h · Fs
```

- `P_alpha`, `P_h`: fixed polynomials (Horner form, x87 80-bit), coefficients in §3.
- `Ql` enters only BB4. QB3/EBS3/EBS6/C4 depend on `Qts'` alone.
- `Rg` is not optional: the wizard designs for the driver *as driven through the source
  resistance*. With `Re = 6 Ω`, `Rg = 0.1 Ω` this shifts `Qts` by +1.4…1.6 % and `Vb` by ~3 %.
  Ignoring it is the "3 % deviation" that first looked like rounding — it was not.
- Binary enum `QB3=0, BB4=1, EBS3=2, EBS6=3, C4=4`; wizard dropdown order is
  `QB3, BB4, C4, EBS3, EBS6` — the two differ.

### Inputs — `ventedAlignment(alignment, Fs, Qts', Vas, Ql)`

| Input  | Where it comes from in OpenISD                                                              | Used by  |
|--------|---------------------------------------------------------------------------------------------|----------|
| `Qts'` | `sourceLoadedQts(Qms, Qes, Re, Rg, Qts)` in `engine/lossMode.ts`, as the sealed wizard uses | all 5    |
| `Rg`   | project `Rs_ohm` (Signal tab "Series resistance"; `.wpr` `[SignalSource] Rg`), 0.1 default  | via Qts' |
| `Ql`   | box losses `box.vented.losses.Ql`, default 10 (§4)                                          | BB4 only |

The wizard hook (`OgNewProject-hooks.ts`) previews with the new-project defaults (0.1 Ω, 10)
and designs the created project against its own `Rs_ohm`/`Ql`; the hook test pins the two
equal.

## 2. BB4/SBB4 — (Super-)Boom Box — ✅

```
h = 1
alpha = ¼·(1/Qts' − 1/Ql)²
```

Same formula as Claus Futtrup, ["Computation of Bass Reflex Alignments"](https://audioxpress.com/article/focus-computation-of-bass-reflex-alignments)
(audioXpress) — WinISD's `in_AL==1` branch reduces to it exactly. SBB4 = same formula at low
`Qts`.

## 3. QB3, EBS3, EBS6, C4/SC4 — polynomial in ln(Qts') — ✅

Coefficients, highest degree first (from `winisd.exe` `0x5ea700`–`0x5ea9e0`, 10-byte x87
extended literals):

- **QB3** — alpha (deg 7): `-0.527653766418192, -4.045037842606329, -10.388310807896415,
  -5.25594713440707, 21.601394321188952, 40.33530712040413, 22.661419872287436,
  2.717622080740771`
  h (deg 4): `-0.029801244681591, -0.195366397032358, -0.437959753294342,
  -1.355136486318576, -0.999127306592246`
- **EBS3** — alpha (deg 4): `0.006359580444886, 0.284719820427248, 1.201995900184085,
  -0.509649345433783, -1.784408772362153`
  h (deg 4): `0.015424255373668, 0.172186160819739, 0.620617168304417,
  -0.084975509883162, -0.76456030458537`
- **EBS6** — alpha (deg 4): `-0.229471801052817, -0.901670322424065, -0.410672175645899,
  -0.41030467280452, -1.207690336319967`
  h (deg 4): `-0.229066066258841, -1.231981240907907, -2.116888241589388,
  -2.07475979269649, -1.434673514434639`
- **C4/SC4** — alpha (deg 6): `2.042092829582793, -0.285129728592432, -25.76924674836319,
  -53.426473674138194, -41.84812814959069, -16.515214504570608, -4.222667174871261`
  h (deg 6): `-2.661465684928509, -17.790020226363403, -45.116813494746765,
  -54.76142489283109, -33.41178255237291, -10.570811827917767, -1.866019821604128`

Notes:
- **QB3**: WinISD's QB3 is this polynomial, not the textbook `15·Vas·Qts^2.87` OpenISD had
  before 2026-09-22.
- **C4/SC4**: WinISD does not run Futtrup's iterative Chebyshev solve (`e = Qt/Ql`, cubic
  iteration); it uses this fixed polynomial with no `Ql` term. C4 is WinISD's default vented
  alignment.
- Validity range: captures cover `Qts` 0.25–0.60 only. The polynomials are fits of unknown
  domain; outside that range they may diverge. Clamp or warn — do not extrapolate silently.

## 4. Ql — where it comes from

`Ql` defaults to 10 (`Qa` 100, `Qp` 100), matching WinISD ([`WINISD_PARITY.md` §5](WINISD_PARITY.md?html#5-box-losses-ql-qa-qp--confirmed-from-help-file)).
Only BB4 reads it. `Qa`/`Qp` are not used by any alignment.

## 5. Evidence

### Captures (60 runs)

`winisd_research/runs/vented_alignments.jsonl`. `Fs = 40 Hz`, `Vas = 0.02 m³`, `Qms = 4.0`,
`Re = 6 Ω`, `Rg = 0.1 Ω`, `Ql = 10`, `Qa = Qp = 100` for every row; `Qts` and alignment
varied. `Vb`/`Fb` below are rounded; the jsonl holds 15 significant digits and the validation
matches those. Qts 0.15–0.20 and 0.70–1.0 are outside any sane vented range: WinISD does not
clamp, it extrapolates the polynomials and writes whatever comes out (C4 at 1.0: 1684 L, 5.4 Hz).

| Qts  | QB3 Vb/Fb     | BB4 Vb/Fb      | C4 Vb/Fb       | EBS3 Vb/Fb     | EBS6 Vb/Fb    |
|------|---------------|----------------|----------------|----------------|---------------|
| 0.15 | 1.40 / 101.14 | 1.92 / 40.00   | 0.00 / 64.78   | 3.99 / 75.74   | 5.79 / 54.53  |
| 0.20 | 2.69 / 76.38  | 3.44 / 40.00   | 2.17 / 41.02   | 7.59 / 56.75   | 11.28 / 40.18 |
| 0.25 | 4.51 / 61.71  | 5.43 / 40.00   | 5.25 / 41.68   | 12.60 / 45.51  | 18.18 / 32.62 |
| 0.30 | 7.28 / 51.96  | 7.90 / 40.00   | 7.34 / 44.28   | 18.94 / 38.24  | 25.53 / 28.25 |
| 0.35 | 11.82 / 44.94 | 10.86 / 40.00  | 11.49 / 43.46  | 26.42 / 33.24  | 32.55 / 25.45 |
| 0.39 | 17.45 / 40.57 | 13.59 / 40.00  | 17.29 / 40.68  | 33.03 / 30.28  | 37.62 / 23.82 |
| 0.45 | 30.40 / 35.37 | 18.32 / 40.00  | 30.71 / 35.47  | 43.68 / 26.98  | 44.10 / 21.90 |
| 0.50 | 45.22 / 31.90 | 22.85 / 40.00  | 45.17 / 31.68  | 52.89 / 24.96  | 48.47 / 20.57 |
| 0.60 | 73.15 / 26.50 | 33.58 / 40.00  | 75.32 / 26.92  | 71.15 / 22.19  | 54.84 / 18.17 |
| 0.70 | 67.16 / 22.43 | 46.67 / 40.00  | 107.02 / 24.13 | 87.82 / 20.49  | 59.01 / 15.85 |
| 0.80 | 31.95 / 19.23 | 62.25 / 40.00  | 172.61 / 20.00 | 101.78 / 19.45 | 62.02 / 13.56 |
| 1.00 | 0.99 / 14.48  | 101.52 / 40.00 | 1684.49 / 5.40 | 119.85 / 18.60 | 67.26 / 9.28  |

(Vb in L, Fb in Hz.)

### Not tested

| Setting                           | Status                                                                                   |
|-----------------------------------|------------------------------------------------------------------------------------------|
| `Qts` 0.15–1.0                    | Captured (25 rows). No clamp; polynomials extrapolate. Reproduced to 2.3e-14.            |
| `Fs`, `Vas`, `Qms`, `Re` varied   | Not captured. `Vb ∝ Vas`, `Fb ∝ Fs` per the decompile; `Re`/`Qms` enter only via `Qts'`. |
| `Rg` ≠ 0.1                        | Not captured. `Qes'/Qes = 6.1/6` at all 7 Qts fixes the correction form.                 |
| `Ql` ≠ 10 for BB4                 | Not captured. Exact algebra from the decompile.                                          |
| Editing `Vas` after wizard create | Not tested. `.wpr` stores no alignment tag on the Box record; most likely one-time.      |

## 6. Open

1. Out-of-range `Qts` — CLOSED 2026-09-22: 25 captures at 0.15 / 0.20 / 0.70 / 0.80 / 1.0
   all reproduce the polynomials to 2.3e-14. WinISD does not clamp. The engine extrapolates
   the same way, so it matches WinISD there — including the nonsense (C4 at Qts 1.0: 1684 L).
   Whether OpenISD should refuse or warn instead of matching is a product call, not a parity
   one: [`FIX_WIZARD_VENTED-remains.md`](../plans/FIX_WIZARD_VENTED-remains.md?html) #2.
