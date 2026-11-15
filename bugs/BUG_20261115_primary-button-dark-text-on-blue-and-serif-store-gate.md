# BUG_20261115_primary-button-dark-text-on-blue-and-serif-store-gate

**Status:** OPEN (found reviewing the T793 baselines; not fixed there)

## Symptom
Primary button label is dark navy on royal blue, and the store gate falls back to a serif font.

The primary buttons ("Export everything", "Export my data") have poor contrast, and the store gate text is drawn in a default serif face instead of the skin's font. Seen by one outside reviewer (agy), not by the other; check at full size before fixing.

## Evidence
Baseline picture(s): mobile-dialog-shared-store-gate, desktop-dialog-shared-store-gate, mobile/desktop-dialog-shared-driver-delete-challenge-warning, mobile-dialog-driver-storage-error.

## Fix
Not done in T793. Test first when taken.
