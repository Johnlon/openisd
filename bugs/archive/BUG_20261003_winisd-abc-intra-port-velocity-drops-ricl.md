# BUG_20261003_winisd-abc-intra-port-velocity-drops-ricl

**Status:** FIXED by default — OpenISD draws the correct velocity; the "WinISD ABC intra-port velocity" error switch (off by default, ABC boxes only) brings WinISD's chart back.

## Symptom
In an ABC box, WinISD's Intra port velocity chart divides the rear-chamber pressure by jωMai + Zf,
leaving the inter-chamber leak Ricl out. WinISD's own box load and every other ABC chart use
Zi = Ricl ∥ jωMai. One formula, two answers inside WinISD.

## Steps to reproduce
1. Run `winisd_research` capture `abc-w5-1` (W5-1138SMF, Qiclfr 20), or load
   `packages/design/test/winisd/fixtures/abc-w5-1.wpr` in OpenISD.
2. In OpenISD, Compatibility panel: tick "WinISD ABC intra-port velocity" (or press Reset). The
   Intra port velocity chart matches WinISD to 1e-9.
3. Untick it. The chart changes by: under 0.02 dB at 42 and 60 Hz, 0.38 dB at 100 Hz, 4.2 dB at
   5 kHz, 14.2 dB at 20 kHz.
4. Set the inter-chamber leak Qiclfr very large (capture `abc-w5-qicl1e6`, Qiclfr 1e6): the switch on matches WinISD at 1e-9, the switch off at 3.3e-6, and the gap between off and on shrinks as 1/Qiclfr (`packages/design/test/engine/abc-large-qiclfr-winisd.test.ts`).

## Fix
`engine/boxes/AbcBox.ts`: UPi divides by Zi + Zf, the same Zi the load uses; the switch
(`winisdAbcIntraPortVelocity`) keeps WinISD's V/(jωMai + Zf). Tests:
`packages/design/test/engine/abc-intra-port-velocity.test.ts`,
`packages/design/test/domain/winisd-abc-intra-port-velocity.test.ts`,
`packages/ui/test/ui/error-switches.browser.spec.ts`. Listed in
[ACCURACY_IMPROVEMENTS.md](../docs/research/ACCURACY_IMPROVEMENTS.md?html).

## Open
A WinISD-only recipe a user can run to see the contradiction inside WinISD is not done. The WinISD capture at a very large Qiclfr is done (2026-10-03, `winisd_research/runs/abc-w5-qicl1e6`).
