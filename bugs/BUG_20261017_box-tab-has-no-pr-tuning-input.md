# BUG_20261017_box-tab-has-no-pr-tuning-input

**Status:** OPEN (held: John has not ruled)

## Symptom
On the Box tab of a passive radiator box, the tuning (Fh) is a read-only value on both skins. It can be
entered only on the Passive Radiator tab. Vented, bandpass and ABC boxes take their tuning on the Box tab.

## John's words
16 Oct 2026, on whether the passive radiator should take its tuning on the Box tab: "not sure about pr".

## Fix
Held until John rules. If he says yes: the PR tuning field of the Passive Radiator tab is shown enterable
on the Box tab of both skins, the same field, with a browser spec per skin.

## Verification
A browser spec per skin: the passive radiator Box tab has an enterable tuning field, and entering it
changes the same value on the Passive Radiator tab.
