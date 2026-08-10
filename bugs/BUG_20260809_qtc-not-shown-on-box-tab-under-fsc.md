# BUG_20260809 — Box tab does not display calculated Qtc and Fsc for sealed enclosures

**Status:** OPEN — not yet fixed.

## Symptom

When a sealed enclosure is selected, the Box tab in OpenISD (both in the Modern skin and the Classic skin, which reuse the shared `BoxPanel.vue` component) does not display the calculated system resonance frequency (`Fsc`) or the calculated system Q (`Qtc`).

In classic WinISD, the Box tab prominently displays both `Fsc` and `Qtc` under the box volume input when a sealed box is active, providing critical feedback to the speaker designer on how the volume `Vb` affects the box's acoustic alignment.

Currently in OpenISD:

- The shared `BoxPanel.vue` has no display for `Fsc` or `Qtc`. The designer must look at the small application-wide StatBar at the bottom of the window to see `Qtc`, which is easy to miss, and `Fsc` is not shown in the StatBar either.
- In the "Original" skin (`OriginalShell.vue`), there is a layout displaying `Fsc` and `Qtc` under volume, but this layout is not shared with the other skins.

## The code

- The shared `BoxPanel` component displays only `boxtype`, `Vb`, `Ql`, `Qa`, and `Qp`, plus a one-shot button to set Vb for Qtc=0.707:
  [BoxPanel.vue](../packages/ui/src/components/BoxPanel.vue#L61-161)
- The "Original" skin (`OriginalShell.vue`) has custom rendering of `Fsc` (using `boxResonance`) and `Qtc` (using `rearQtc` calculated from `driver.Qts` and `state.P.Vb`):
  [OriginalShell.vue:L969-973](../packages/ui/src/shells/original/OriginalShell.vue#L969-L973)
- The StatBar calculates `Qtc` and `fc` (system resonance) but only displays `Qtc` in a small span:
  [StatBar.vue:L39-56](../packages/ui/src/components/StatBar.vue#L39-L56)

## Root cause

The shared `BoxPanel.vue` component was built with a simplified input/layout set that omitted these derived readout fields for sealed boxes, expecting the user to rely on the alignment button or the StatBar. This broke visual and functional parity with classic WinISD's Box tab.

## Suggested Fix

1. **Expose readouts in `BoxPanel.vue`:**
   Add calculated, readonly display rows for `Fsc` and `Qtc` in [BoxPanel.vue](file:///home/john/work/winisd/openisd/packages/ui/src/components/BoxPanel.vue) when `state.box === 'sealed'`.
   - `Fsc` can be computed using `d.Fs * Math.sqrt(1 + d.Vas / state.P.Vb)`.
   - `Qtc` can be computed using `d.Qts * Math.sqrt(1 + d.Vas / state.P.Vb)`.
2. **Parity check:**
   Ensure the presentation style matches the rest of the inputs (e.g. greyed/readonly inputs with proper unit indicators).
