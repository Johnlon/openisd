# BUG_20261018_deploy-keys-not-passed

**Status:** FIXED (T413)

## Symptom
After T398 landed, the deploy run on main failed in deploy / assemble: "Load key ... error in libcrypto",
"Permission denied (publickey)". snapshots.openisd.app/v/<stamp>/ stayed 404. Run 39151843947.

## Cause
build.yml and release.yml call deploy.yml as a reusable workflow without `secrets: inherit`. A called
workflow gets no repo secrets unless its caller passes them, so TEST_SITE_DEPLOY_KEY and
SNAPSHOTS_SITE_DEPLOY_KEY were empty. The secrets themselves are set.

## Fix
`secrets: inherit` on both calls. Test: packages/ui/test/scripts/release-workflows.test.ts.
