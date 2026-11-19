# Plan: Save, sync and undo (18 Nov 2026)

Status: draft for John. Nothing here is built except step 1.

## What John has decided (questions.yml, card topic-1118-032402)
- QO946.c248, "a": Cloud sync sends the whole project, unsaved edits included, a few seconds after editing stops. The save bar and
  the "not on your other devices yet" list (T886) go.
- QO946.c249: "we do need a plan for save and I think it's ok as it is for now, one level cross machine undo". Save stays one
  checkpoint; every machine shares it; Revert goes back to it on any device.
- Earlier, same card: "save might have a benefit if we had and undo q" (c242); "maybe the save button can mutste into a snapshot
  button" (c245); "so undo to checkpoint".

## Facts (from the code and the stats, 18 Nov)
- Edits are kept on the device as they are made; nothing is lost without Save.
- Only 78 of 664 people have ever pressed Save (stats page, people counted by browser).
- Today the only undo is each number box's own one-step undo (packages/ui/src/hooks/NumInput-hooks.ts).

## Steps
1. Sync the whole project (T892, building). Save = one shared checkpoint; Revert = one-level undo on any machine.
2. Undo history for the open project (Ctrl+Z / Ctrl+Y on desktop, an undo button on the phone): every committed edit is a step;
   kept for the session; a page reload keeps it. Logic in packages/ui/src/logic (UI display only). About 1.5 days.
3. Snapshots: Save becomes "Snapshot" and keeps the last N checkpoints (N = 10?), each with its time and device, synced;
   "Back to..." lists them and returns to one (the current state becomes a snapshot first, so nothing is lost). Needs a change
   to the stored project (John's agreement: no data-model change without him). About 2 days.

## Questions for John (with step 2 and 3)
- Step 2 first, step 3 first, or both?
- Snapshots: how many kept (10, 20, all for 30 days)?
- Does the button keep the word Save (WinISD has Save) or become Snapshot? WinISD parity says keep Save by default.
