# Sealed alignment resizes the box when the driver changes

**Status:** FIXED (T495)

## What happened
Picking a sealed alignment (Qtc) stored the Qtc as the entered value and calculated the volume from it. Editing
the driver (Qts, Fs, Vas) then resized the box to keep the Qtc. WinISD keeps Vb fixed and lets Qtc move
(`_agent_files/research/SEALED_ALIGNMENT_WINISD_VS_OPENISD.md`, observed in the `.wpr`).

## Ruling
John, QO274, 20 Oct 2026: "keep the vol". No switch, no cue: this is WinISD's way.

## Fix
Picking an alignment (project picker and new-project wizard) stores the resulting volume as the entered value; Qtc is
calculated. A Qtc typed on the Box tab stays an entered Qtc (WinISD has no editor-side picker, so nothing to copy).
An old file that stored Qtc entered still loads unchanged: it shows that Qtc, with the volume calculated, until the
user picks or types a volume.
