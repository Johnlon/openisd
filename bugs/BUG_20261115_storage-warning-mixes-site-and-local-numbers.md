# BUG_20261115_storage-warning-mixes-site-and-local-numbers

**Status:** OPEN (found reviewing the T793 baselines; not fixed there)

## Symptom
The storage warning prints the site's percentage next to the local store's figures.

"Storage is 99% full (1 project, 20.7 KB of 5 MB used)": `storageFullPercent` (packages/design/fields/browserStorage.ts) takes the fuller of the local store and the site's whole allowance, but the bracket always gives the local store's figures, so a full site with a small store reads as a contradiction. The test's stub (usage 99 of 100 bytes) is a legitimate state; the sentence has to say which measure is full.

## Evidence
Baseline picture(s): desktop-dialog-storage-usage-warning, mobile-dialog-storage-usage, both skins of shared-storage-warning.

## Fix
Not done in T793. Test first when taken.
