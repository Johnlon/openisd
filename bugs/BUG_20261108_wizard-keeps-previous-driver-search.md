# BUG_20261108_wizard-keeps-previous-driver-search

**Status:** RESOLVED

## Symptom
A driver search or filter typed in one New Project wizard session is still applied the next time the wizard opens; the stale filter hid the driver a user looked for.

## Evidence
Live review of test.openisd.app v20261108T0610Z. new-project-wizard.browser.spec.ts already clicks "Clear filters" as a workaround.

## Cause
The driver filters live in the app-wide driver-browsing state, which outlives the wizard; the wizard never cleared them on opening.

## Fix
Both wizards call driverBrowsing.clearAllFilters() when they open.

## Verification
new-project-wizard.browser.spec.ts: search, close, reopen, search box empty and no filter chips.
