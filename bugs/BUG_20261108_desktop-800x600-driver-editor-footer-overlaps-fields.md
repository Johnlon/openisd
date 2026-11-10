# BUG_20261108_desktop-800x600-driver-editor-footer-overlaps-fields

**Status:** OPEN

## Symptom
Desktop skin in an 800x600 window, Driver Editor: the footer buttons "Import" and "Copy to My Drivers" overlap number boxes and their stepper buttons by up to 85x6 px.

## Evidence
`packages/ui/test/ui/screen-sizes.browser.spec.ts`, "may-scroll desktop 800x600: Driver Editor", marked test.fail with this bug id.

## Cause
Not investigated.

## Fix
Not fixed here. T747 only records and tests the sizes (UI-5, sizes proposed in QO471).
