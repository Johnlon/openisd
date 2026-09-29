# WinISD parity summary — keep README in step with the register

The README's "Parity state" and "Remaining gaps" bullets (section "OpenISD and WinISD") summarise
[`docs/research/WINISD_EQUIVALENCE.md`](../../docs/research/WINISD_EQUIVALENCE.md). They must say
what the register says.

- Any commit that changes a register cell or its Aggregate table also updates those README
  bullets, in the same commit:
  - the matched count ("N of M cells") and the date;
  - the gap list: add a gap when a cell turns ✗/❔/⛔, and remove it when every cell it
    names is matched.
- The gap list names the WinISD feature and the boxes, in plain words. It never carries
  deviation figures, bug ids or run names; those stay in the register.
- The register is the source. When the README and the register disagree, correct the README
  from the register, never the other way round.
- A register change only in prose (no cell or count changed) needs no README edit.
