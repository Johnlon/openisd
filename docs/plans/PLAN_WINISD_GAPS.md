# Plan — close the open WinISD gaps

Gap list: [`OPENISD_WINISD_GAPS_AND_BUGS.md`](../../OPENISD_WINISD_GAPS_AND_BUGS.md). Each bug doc
carries its own unit-test verification spec. TDD per `.claude/rules/tdd.md`: red first, one
commit per item.

1. **Voice-coil inductance.** Decide between one switch (Le in both curves or in neither,
   matching WinISD's toggle) and keeping `'winisd'`/`'gyrator'` as two named states. Fix
   `circuit.ts`, correct its comment, and add the `Engine.sweep` test.
2. **Sealed-box leakage order.** Build the leak model: constant `Ral` at Fc, with the leak
   subtracting from the driver. Confirm it against the WinISD traces, which are currently
   unverified.
3. **Air model.** Make one `solveEnvironment` call feed both the driver solve and the sweep.
   Delete both `useWinisdAirModel` defaults: the driver solve omits the flag, and `#sweepParams`
   uses `?? true`.
4. **TF-magnitude reference.** Use one source for the 1 W/1 m sensitivity, either the sweep's
   passband level or the efficiency formula, in both the driver readout and `tfMag`.
5. **EMF convention.** Get John's ruling on Re+Rg vs Re.
6. **Terminal Re/BL readout.** Add the misc-field readout once items 1–4 are done, so the number
   it shows can be trusted.
