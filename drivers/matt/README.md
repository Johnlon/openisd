# Matt (mtg90) driver collection

Contributor: Matt, known as mtg90 on AVS Forum
Source: https://www.avsforum.com/threads/common-sub-driver-winisd-files.2928258/

General import and fixing rules are in [`drivers/README.md`](../README.md). The sections below are specific to this collection.

---

## WT3 filename prefix

`WT3 ` is **not** a username — `WT3` is the Woofer Tester 3, a T/S measurement device. mtg90 stated (AVS Forum post #3, Oct 23 2017):

> "Anything with the WT3 prefix means I tested that driver on either the WT3 or DATS v2 at some point and those are the specs I measured."

These are real measured T/S parameters, not manufacturer spec-sheet data. Variance from published datasheets is expected and not a quality issue. The prefix is a measurement provenance marker:

- **Keep it in the filename** — it is the contributor's original file name and must not be changed.
- **Do not carry it into `Brand=` or `Model=`** — strip `WT3 ` from those fields.
- Every WT3 file has a `_meta.json` recording this provenance for display in the UI.

---

## Restoring from archive

To restore the matt collection from the original archive with approved transformations only, run:

```bash
python3 scripts/restore_matt_from_archive.py
```

See script header for full documentation of transformations.
