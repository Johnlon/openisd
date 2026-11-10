# BUG_20261110_announcements-default-to-test-server

**Status:** FIXED (T750)

## Symptom
`createAnnouncementCenter` took its `endpoints` argument with a default: the TEST announcements server. A
production caller that forgot the argument would show test announcements to real users, and nothing would fail.

## Evidence
- `packages/ui/src/logic/announcementCenter.ts`: `endpoints: AnnouncementEndpoints = announcementEndpointsForHostname('test.openisd.app')`.
- Only caller in shipped source, `packages/ui/src/main.ts`, passes `announcementEndpointsForHostname(window.location.hostname)`; 4 test calls relied on the default.

## Cause
A default parameter value (John, 10 Nov 2026: "this is criminal software practice").

## Fix
Default removed; main.ts passes explicitly; tests take `testAnnouncementEndpoints()` from `packages/ui/test/fixtures/announcementEndpoints.ts`.

## Verification
`packages/ui/test/logic/announcementCenter.test.ts`: the function declares 3 required parameters; production hostnames map to the production origin.
