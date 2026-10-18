# BUG_20261018_release-test-red-and-unrun

**Status:** FIXED — T398 (bob).

## Symptom
`bash scripts/land/test/release.test.sh` failed 15 checks on main at 0b94288d: every promotion in
it stopped with "Cannot find module .../scripts/hosting/test/hosted-copies.e2e.mjs".

## Cause
- T396 made release.sh run `scripts/hosting/test/hosted-copies.e2e.mjs`, and T381 made it run
  `scripts/ui-gallery/capture.mjs`. The test's scratch repo holds a copy of release.sh only, so
  neither script exists there and every promotion refused.
- No gate runs `scripts/land/test/*.test.sh`: not the land gates, not the GitHub suite. So the red
  test went unseen.
- The test's gh stand-in answered `gh release view` only for a named tag, so the gallery's
  "before" (the Latest release) was never exercised.

## Fix
- The scratch repo gets stand-ins for both scripts that record how release.sh called them; the test
  checks the e2e runs and the gallery gets the right before and after addresses.
- The gh stand-in answers `gh release view` with no tag as the Latest release.

## Open
- Nothing runs the shell tests under scripts/land/test/. Raised with opi.
