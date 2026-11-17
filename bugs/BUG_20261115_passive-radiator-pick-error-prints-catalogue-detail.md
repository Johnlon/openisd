# BUG_20261115_passive-radiator-pick-error-prints-catalogue-detail

**Status:** OPEN (found reviewing the T793 baselines; not fixed there)

## Symptom
Passive radiator pick error prints developer detail.

The message ends "bundled catalogue: /catalogue.json lists dayton-audio/e150he-pr (uuid) but holds no record for it - rebuild the app". A user cannot act on it; the file name, uuid and "rebuild the app" are for developers.

## Evidence
Baseline picture(s): desktop-dialog-projects-new-passive-radiator-pick-error, mobile-dialog-phone-wizard-passive-radiator-pick-error.

## Fix
Not done in T793. Test first when taken.
