# BUG_20261030_wdr-connection-reading-judged-as-numvc

**Status:** RESOLVED (T619)

## Symptom
A driver record's voice-coil connection reading (series or parallel) was checked as if it were
the voice-coil count. Its range warnings, plausibility check and "sources disagree" warning named
`numVC`, so the warning pointed at the wrong field.

## Cause
`DriverRecordConverter.#projectVoiceCoilTuple` projected the `connection_reading` entry under the
field name "numVC". The result was stored as `VCCon` but every check ran against `numVC`.

## Fix
Project it under "VCCon".

## Test
`packages/design/test/winisd/driverRecordConverter.coverage.test.ts`: "judges the connection
reading as the connection (VCCon), not as the coil count (numVC)".
