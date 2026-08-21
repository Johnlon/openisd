# `C` constant disagrees with `.wdr` default in last digit

# Status
RESOLVED — neither `packages/engine/src/constants.ts` nor `packages/winisd/src/winisdDriver.ts`
defines a hardcoded `RHO`/`C` literal any more (both greps empty); `driver.ts` no longer
imports `RHO`/`C` at all. `c`/`roo` are now computed live via CIPM-2007
(`packages/engine/src/air.ts`), which moots the "which frozen digit" question this bug raised.

## Symptom

```
packages/engine/src/constants.ts:20:      C = 343.684120962153
packages/winisd/src/winisdDriver.ts:92:   c = 343.684120962152
```

Both values are real WinISD output, from different files. `...153` is in the `.wpr` goldens
and fresh WinISD-created files. `...152` is in ~90 `.wdr` sample files under `drivers/`.

## How WinISD resolves a driver's `c`/`roo` — SETTLED

The complete rule, machine-verified with distinct markers per source (12 clean cells, every
observation matching exactly one source), is documented in
`docs/design/WINISD_SCHEMA.md` §12. Summary:

```
c   = driver.c                              if present
      else sqrt(GAMMA * p_app / driver.roo) if driver.roo present
      else app-level live c

roo = driver.roo                            if present
      else app-level live density
```

- The project-level T/RH/AP feeds NOTHING here — inert for `c`/`roo` in every cell.
- Entry path (in-project vs Manage Drivers) makes no difference.
- Interactive blanking is order-dependent: `c` re-derives only at the instant `c` is blanked,
  from `roo`'s value at that moment; blanking `roo` later does not refresh `c` (WinISD quirk,
  leaves an inconsistent pair — do not replicate).

Since `c`/`roo` track a mutable app-level setting, two WinISD-authored files carrying
`...152` vs `...153` most plausibly reflect marginally different effective app-level values
at their respective save times — neither digit is "the" constant.

## Open

- Which digit (`...152` vs `...153`) belongs where in openisd — a design decision, not a
  discoverable fact, given the above. (The New Driver path was tested 2026-08-20 and follows
  the same rule — no special case remains.)

**Do not replace either digit with the other anywhere in the codebase.**

## Impact on openisd

`packages/engine/src/driver.ts:35-40` (`airOf`) falls back to a fixed `RHO`/`C` constant
whenever `c` or `roo` is missing. This differs from real WinISD on two counts:
- it doesn't recompute a missing `c` from a present `roo` at the ambient pressure;
- WinISD's ultimate fallback is a live app-level setting, which openisd has no concept of —
  whether openisd should model that store or keep the fixed-constant simplification is a
  design decision.

Not fixed — calculation-logic change, needs human sign-off (AGENTS.md "Calculation logic —
permission gate").

Also flagged, not yet investigated: `driver.ts:124,174,437,439` use the bare `RHO`/`C`
constant instead of the driver's own air, inside code meant to use per-record air.
`air.ts`'s `winisdAir()` (temperature-scaled `RHO`/`C`) may also need revisiting given the
above.

## Verification

`npx vitest run packages/winisd/test/openisdToWdr.test.ts` — 1/14 fails on this mismatch.
Not resolved — see "Open" above.
