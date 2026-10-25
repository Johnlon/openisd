# Redirect round trip test: real Google answers 401 to the fake token (flaky on CI)

Status: closed (T358)

## Symptom
Spec `redirectRoundTrip.browser.spec.ts` failed on CI (runs 39040471961, 39037834973) with the fixture's diagnostics: "console errors (1): Failed to load resource: the server responded with a status of 401 ()". The spec's own checks pass.

## Cause
Not the app. The spec stubs Google's sign-in page and returns the fake token `ya29.stubbed_round_trip`. The app, now signed in, runs its boot sync against `www.googleapis.com`, which the spec did not route. On CI, with internet, real Google answers the fake token 401. Whether the request is sent and answered before the test ends depends on timing, so most runs pass.

## Fix
The spec routes `www.googleapis.com` to the Drive emulator (`emulateDriveServer`, split out of `connectedToDrive`), so every Drive request is answered as the service would. The 401 is not filtered from diagnostics.

## Verification
Spec passes 20 of 20 locally. Typecheck passes.
