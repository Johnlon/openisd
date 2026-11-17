# BUG_20261108_project-list-names-cut-with-ellipsis

**Status:** RESOLVED

## Symptom
Desktop project list: the name cell ("AS168-9-470 vented", 110-167 px of text in a 102 px cell) is cut with an ellipsis for every project in the sample. The phone driver library row "SB Acoustics SB15BAC30-8-COAX/ aluminum" (336 px in a 308 px row) is cut too.

## Evidence
Live review of test.openisd.app v20261108T0610Z, ui-gallery/live-review/LATEST/. `.project-name` in OriginalProjectList.vue is nowrap with text-overflow ellipsis.

## Cause
Name cells are single-line with ellipsis in a narrow column; the phone library row likewise.

## Fix
Names wrap (whole name always shown): .project-name in OriginalProjectList.vue and .dl-name in DriverLibrary.vue (phone).

## Verification
original-project-list.browser.spec.ts and mobile-pr-library / driver library spec: no cell text truncated, no horizontal scrollbar.
