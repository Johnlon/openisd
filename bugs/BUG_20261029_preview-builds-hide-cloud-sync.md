# BUG_20261029_preview-builds-hide-cloud-sync

**Status:** RESOLVED (T611)

## Symptom
A task preview (e.g. http://lap:4607) had no Cloud sync: no menu entry, no header badge, no
Cloud sync window. openisd.app has them. The preview was a different app from production.

John, 29 Oct 2026: "wtf is it build differently?", "you dont make diffetne builds of the app ffs !!"

## Evidence
- `packages/ui/src/main.ts:122` reads `import.meta.env.VITE_GOOGLE_CLIENT_ID`; with no value the
  cloud sync UI is not built (`main.ts:337`, `MobileShell.vue:209` `v-if="cloudEnabled"`).
- The value was set only in `.github/workflows/build.yml` from the GitHub repo variable
  `vars.VITE_GOOGLE_CLIENT_ID`. No file in the repo carried it, so local dev servers, local builds
  and the CI test suite built the app without cloud sync.

## Cause
A build setting that changes what the app shows lived outside the repo, in a GitHub variable that
only the deploy build read.

## Fix
The client id is public (it ships in every production bundle). It is now committed in
`packages/ui/.env`, which Vite reads for every build, and the workflow no longer sets it.
Gate: `packages/ui/test/architecture/architecture-every-build-has-cloud-sync.test.ts` fails if the
file loses the id or any workflow sets it.

⚠ unverified: Google sign-in itself only works on origins registered on the OAuth client. On
http://lap:4XXX the Cloud sync UI now shows, but Google may refuse the sign-in there.

## Verification
The gate test went red before the fix (both cases) and green after. A restarted task preview
shows Cloud sync in the phone menu, as on openisd.app.
