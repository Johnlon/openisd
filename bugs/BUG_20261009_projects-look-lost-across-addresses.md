# BUG_20261009_projects-look-lost-across-addresses

**Status:** RESOLVED - Fix: Added origin display to open dialog, full archive export/import functionality, and explicit quota-exceeded handling with export offer.

## Symptom
John, 9 Oct 2026: "why do I lose my projects". Projects live only in the browser storage of the address the app was opened at (openisd.app, localhost:4000, lap:4000, 100.89.77.0:4000, the installed phone app vs the browser tab). A project saved at one address is missing at another, and nothing in the app says so. John: "address thing may explain it".

## Evidence
Browser storage is per origin (scheme + host + port); OpenISD stores projects in localStorage (`openisd_projects`).

## Cause
Storage is per origin by design; the app never shows which store it is using.

## Fix
- The file-open dialog and the project list name the store ("Projects saved in this browser at <address>").
- One-step export of all projects to a file, and import of that file, so projects move between addresses.
- A save that fails (quota full) says so and offers export; it is never silent.

## Verification
Browser spec: the store's address is shown in the open dialog; export then import into a fresh storage restores every project; a forced quota error on save shows the message.
