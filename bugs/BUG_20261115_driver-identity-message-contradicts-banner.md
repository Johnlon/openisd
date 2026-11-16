# BUG_20261115_driver-identity-message-contradicts-banner

**Status:** OPEN (found reviewing the T793 baselines; not fixed there)

## Symptom
Driver identity popup says Brand and Model are both required while Model is filled.

The popup title reads "Brand and Model are both required", the banner behind it says "Saves fine, but can't be filed under a name", and only Brand was emptied. The wording does not match the state.

## Evidence
Baseline picture(s): desktop-dialog-driver-identity-message.

## Fix
Not done in T793. Test first when taken.
