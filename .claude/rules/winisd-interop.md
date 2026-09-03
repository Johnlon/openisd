---
paths:
  - "packages/design/winisd/**"
  - "packages/winisd/**"
  - "drivers/**"
---

# WinISD interop

**We do not replicate WinISD's bugs.** OpenISD reads WinISD's FORMAT faithfully and writes
CORRECT VALUES into it, including in the `.wdr` it emits.

An oracle file in `drivers/sample/winisd/` records what WinISD DID. It is evidence about the
format, never a specification of correct values. When our output differs, decide which is wrong.

Example: WinISD always writes `VCCon=1` on save whatever the UI shows
(`docs/design/WINISD_SCHEMA.md` §3.2), so `s-connection-serial-2vc.wdr` reads `1` despite being
series-wired. `driverYmlToOpenisdAndWdr.ts` writes `2`, and its test asserts that.

A deliberate divergence carries a comment saying it is deliberate.

**Driver data is read-only here.** It is produced by winisd_tools. Scripts that touch, patch,
normalise or backfill `drivers/` are banned. `drivers/matt/` is human-curated — never touch it in
any script or batch edit. Only a human sets `reviewed_by` or any "human-verified" field.

Reference for the foreign format: `docs/design/WINISD_SCHEMA.md`, `docs/research/WINISD_PARITY.md`.
Where either disagrees with `ARCHITECTURE.md` about our own record, `ARCHITECTURE.md` wins.

Per-field units: `docs/research/UNIT_BOUNDARY_AUDIT.md` gives file/SI/display/WinISD unit with an
oracle for each.
