# BUG_20260928_front-volume-message-says-4th-order-for-bp6-abc

**Status:** RESOLVED

## Symptom
A new 6th-order bandpass or ABC project with no front chamber volume says "a 4th-order bandpass
needs both chambers".

## Evidence
packages/design/engine/params.ts:71, the Vf entry's `consequence` text, shared by bandpass4,
bandpass6 and abc since the bp6/ABC merge (df81902c). packages/ui/test/logic/store-issue-channel.test.ts
"a new bandpass6 project simulates" shows the sentence in allIssues.

## Cause
The Vf requirement was written when bandpass4 was the only two-chamber box.

## Fix
Say "a bandpass box needs both chambers", or name the box type from the requirement's caller.

## Verification
The store-issue-channel bandpass6/abc cases assert the message names no box order it isn't.

## Resolution (2026-09-29)
params.ts VF consequence now reads "this box has two chambers, and the front one needs a volume before the response can be drawn" (plain words, per John: the formula wording made no sense to a human). params.test.ts: bandpass6/abc cases assert no "4th-order", red before, green after.
