# BUG_20261017_laptop-suite-server-dies-mid-run

**Status:** OPEN (owner maryu; investigation starts once T266 is live)

## Symptom
The laptop post-land run on 9a5062a2da went red (F49). Driver-editor specs failed in about 200 ms each,
then "529 did not run" and "1 error was not a part of any test". GitHub Actions ran the same sha green
(run 38991195452). The test server most likely died partway through the run.

## Evidence so far
The F file keeps only the last 40 lines of output, so the first error is lost. Part of the fix: keep the
whole output of a red run where the F can link to it.

## Cause
Not found yet.
