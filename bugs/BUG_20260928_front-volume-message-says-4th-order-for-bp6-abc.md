# BUG_20260928_front-volume-message-says-4th-order-for-bp6-abc

**Status:** OPEN

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
