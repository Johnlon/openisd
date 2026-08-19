# `USPL` and `SPLmax` use formulas WinISD does not — the 2.83 V literal, and a 3 dB derating

# Status
BLOCKED 2026-08-13 — needs a human ruling


**Found** 2026-08-13, bucketing `packages/winisd/test/winisd-parity.test.ts`.
**Severity** wrong number. `SPLmax` is out by a flat 3 dB — that is a factor of two in power on a
figure people size amplifiers against.
**Status** ⛔ **NOT FIXED — blocked on the human.** Both are formulas in
`packages/engine/src/`, which `AGENTS.md` §"Calculation logic — permission gate" reserves to an
explicit human decision: "A discrepancy does not authorise a fix — document it and stop."

Both rules were recovered from goldens WinISD itself wrote, and both are exact to float
precision on every golden available (8 files, 2 distinct drivers, 2 distinct `Pe`).

---

## 1. `USPL` — WinISD drives 2.83 V, openisd drives exactly 8 W-equivalent

`USPL` is the 2.83 V / 1 m sensitivity: the 1 W figure re-referenced to the voltage that puts
1 W into 8 Ω. WinISD uses the **rounded label 2.83 V** as its literal; openisd uses the exact 8.

| | rule | `sealed-small` (SPL 90, Re 6.4) | `vented-small` (SPL 87, Re 3.2) |
| --- | --- | --- | --- |
| WinISD | `SPL + 10·log₁₀(2.83²/Re)` | `90.9739289706469` | `90.9842289272868` |
| openisd | `SPLref + 10·log₁₀(8/Re)` | `88.61978359049809` | `94.043495194922` |

The offset between the two rules is a driver-independent constant,
`10·log₁₀(2.83²/8) = 0.0048288405663` dB, and it is reproduced identically on both drivers to
1e-13 absolute. Predicting each golden's `USPL` from its own `SPL`, `Re` and WinISD's rule
agrees to **4.7e-16 relative on all eight**.

**The code.** `packages/engine/src/driver.ts:241-249` (block 12) and `:390`:

    if (r.USPL == null && r.SPLref != null && r.Re != null && r.Re > 0) {
      setVal('USPL', r.SPLref + 10 * Math.log10(8 / r.Re));
    }
    …
    r.USPL = r.SPLref + 10 * Math.log10(8 / r.Re);

**Proposed rule**, if authorised: `10·log₁₀(2.83² / Re)`, with `2.83` a named constant carrying
this file as its evidence. The inverse routes at `:244-249` invert the same literal.

The larger part of the visible gap in the table above is a **separate** defect — openisd reads
`SPLref` where WinISD reads the file's stated `SPL` (see
`bugs/BUG_20260813_wdr-spl-is-discarded-on-import-and-openisd-substitutes-its-own-computed-sensitivity.md`).
With that fixed the residual is exactly the 0.00483 dB above, and no more.

---

## 2. `SPLmax` — WinISD derates by a flat 3 dB

| | rule | `sealed-small` (SPL 90, Pe 100) | `vented-small` (SPL 87, Pe 60) |
| --- | --- | --- | --- |
| WinISD | `SPL + 10·log₁₀(Pe) − 3` | `107` (exact) | `101.781512503836` |
| openisd | `SPLref + 10·log₁₀(Pe)` | `107.65068346041753` | `107.84560761203807` |

The derating is exactly **3.0 dB, not 10·log₁₀(2) = 3.0103**: `90 + 20 − 3` reproduces the
golden's `107` exactly, whereas 3.0103 would have printed `106.9897` at the goldens' ~15
significant digits. Predicting each golden from its own `SPL` and `Pe` agrees to **0 and
4.3e-15 relative**.

WinISD marks the field `C` at ParState slot 26 on every golden, so this is WinISD's calculation
and not an echoed input.

**The code.** `packages/engine/src/driver.ts:277-279`:

    if (r.SPLmax == null && r.SPLref != null && r.Pe != null && r.Pe > 0) {
      setVal('SPLmax', r.SPLref + 10 * Math.log10(r.Pe));
    }

**Proposed rule**, if authorised: subtract 3 dB, from the STATED `SPL`.

⚠ **The 3 dB has no derivation yet — only a measurement.** It is not `10·log₁₀(2)`, so it is
not "half the rated power"; a flat 3 dB is what the two data points say and nothing here
explains why. Whether openisd should copy an unexplained derating at all is precisely the
human's call, and is the reason this is written down rather than applied. `SPLmax` is a
thermal-limit line on a chart a user sizes an amplifier from; being 3 dB optimistic and being
3 dB conservative are both real, and only one of them is WinISD's.

---

## Both rules read the wrong base, and that half is now visible on its own

`cell('SPL')` returns the file's stated 90 as of the import fix in
`bugs/BUG_20260813_wdr-spl-is-discarded-on-import-and-openisd-substitutes-its-own-computed-sensitivity.md`.
`USPL` and `SPLmax` do not use it: `solveConsistencyGroup` blocks 12 and 13 read `SPLref`, the
η₀-derived sensitivity, so both still start from 87.65 dB instead of 90.

`inconsistent-fs` separates the two halves cleanly. Its `Fs` is written at twice its true
value, which moves η₀ by 10 dB but must not move a STATED sensitivity at all:

| | `USPL` | `SPLmax` |
| --- | --- | --- |
| WinISD | `90.9739289706469` — identical to `sealed-small` | `107` — identical to `sealed-small` |
| openisd | `97.65068346041753` | `116.68158333033696` |

WinISD's answers do not move, because it works from the stated `SPL`. openisd's move by 10 dB,
because it works from η₀. So any authorised fix is **three** changes, not two: the base becomes
the stated `SPL`, the 8 becomes 2.83², and the 3 dB is subtracted.

## Verification, once a decision is made

`npx vitest run --project winisd packages/winisd/test/winisd-parity.test.ts` — 8 `USPL` rows and
8 `SPLmax` rows. If the ruling is "openisd keeps its own rule", both go into
`test/fixtures/winisd-parity/divergences.json` with the ruling as the `reference`, and each
entry's `maxRelative` set to the measured difference — never removed from the comparison.
`packages/engine/test/golden.test.ts` moves either way and is rebaselined explicitly.
