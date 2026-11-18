# BUG_20261118_automated-browsers-count-as-users-in-stats

**Status:** FIXED by T906 (the change that makes the app send no usage stats from an automated browser).

## Symptom
Agents' browser checks (Playwright and the like) against openisd.app and test.openisd.app were counted as real users in the stats (John, board 18 Nov 2026: relying on agents to block the collector "is unrealistic").

## Cause
`chooseEndpoint` chose the collector from the hostname alone. Usage events, crash reports (both through the one telemetry object) and feedback (through the same chosen target) all went out from any browser.

## Fix
`EndpointChoice.automatedBrowser` (required), read once in `main.ts` from `navigator.webdriver === true`; `chooseEndpoint` returns null when it is true. In Vite mode `test` (the browser suite, which runs in Playwright) the spec's `openisdTelemetryOn` opt-in still wins. Usage events, crash reports and feedback all follow the one target, so all three stop.
