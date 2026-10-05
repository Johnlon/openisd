# BUG_20261003_tf-phase-chart-unwrapped-not-winisd-wrapped

Status: FIXED 2026-10-05 (verified against the code) — the `winisdWrapPhase` compatibility switch wraps the TF phase to ±180° by default, as WinISD does.

WinISD wraps transfer function phase to [-180°, +180°], so at 20.02 Hz on a sealed W5 box it reports +158.26°. OpenISD outputs continuous unwrapped phase, reporting -201.74°.

## Evidence

- WinISD 0.7: TF phase at 20.02 Hz is +158.256° (wrapped at ±180°).
- OpenISD `Engine.sweep`: TF phase at 20.02 Hz is -201.737° (unwrapped).

## Required Fix

Wrap transfer function phase to [-180°, +180°] by default to match WinISD native behaviour.
