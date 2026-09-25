---
name: bug-reporting
description: Record bugs properly — create a bugs/*.md file the same turn a defect is noticed. Triggers on "bug", "record bug", "create bug", "file a bug", "is it a bug", "bug review", "next bug", "walk me through the bugs", or when a defect is identified. Also load before presenting any bug to a human.
---

# Bug Reporting — how to record bugs

## The rule

If it is wrong, it gets a `bugs/*.md` file — the same turn it is noticed, before it
is mentioned in the reply. Out of scope to FIX is normal and fine; out of scope to
RECORD is not.

The test: could someone find this defect next week without reading this conversation?
If not, it was flagged, not recorded.

## Before writing the file — verify what kind of claim this is

There are two kinds of claims in a bug record:

| Claim type | What it is | Burden of proof |
|---|---|---|
| **App UI text** | What OpenISD's own interface displays (tooltips, labels, messages) | Verified by reading the source. Safe to report as-is. |
| **External product claim** | What WinISD, LEAP, REW, or any other external system does | Needs primary-source evidence obtained in this conversation. Mark `⚠ unverified` if not yet proven. |

A tooltip saying "WinISD behaviour is unverified" is verified OpenISD text carrying an
unverified claim about an external product. The distinction matters: the app text is
reliable, the external claim needs separate verification before it can be stated as
fact.

## Writing the bug file

Structure:

```
# BUG_YYYYMMDD_short-descriptive-name

**Status:** OPEN

## Symptom
What breaks, in plain terms — not the file's jargon, not a formula dump.

## Evidence
What you re-checked right now — file:line / test name+result / grep output.
The bug file's own Symptom/Cause is a claim about the state of the world when it
was written — NEVER sufficient on its own. Re-verify before recording.

## Cause
The mechanism, not a guess. Mark ⚠ unverified on anything about external systems
you have not proven in this conversation.

## Fix
What would change.

## Verification
How you would check the fix works.
```

## Commands

```
python3 ~/.claude/bin/inbox.py bugs            the FIRST OPEN bug, across every repo
python3 ~/.claude/bin/inbox.py bugs  <id>       that bug file only (filename substring)
python3 ~/.claude/bin/inbox.py bugs list       one line per OPEN/DEFERRED bug (humans)
```

`inbox.py bugs` is READ-ONLY discovery. Status mutation is a direct `Edit` on the
file's `Status:` line, not a script call.

## Presenting a bug to John

Four lines, nothing else. No preamble, no "let me pull up the bugs", no restating
what was already said this session:

```
BUG:      <what's broken, in plain terms>
IMPACT:   <why this matters — one sentence, concrete consequence>
EVIDENCE: <what you just re-checked, right now>
REC:      <recommendation fitting long-term arch goals — not a menu of options>
```

## Recording a ruling

On a ruling, `Edit` the bug file directly:

- **Fix now** → do the fix, THEN flip `Status: OPEN` → `Status: RESOLVED` and fill
  in `## Fix` / `## Verification`.
- **Defer** → `Status: OPEN` → `Status: DEFERRED`, append one line saying why/until when.
- **Wontfix / disputed** → `Status: WONTFIX`, append the human's reasoning verbatim.

A file with no `Status:` line defaults to OPEN — the first time it surfaces, add the
line as part of handling it.

## The "unverified" label

Never assert facts about WinISD, LEAP, REW, websites or APIs without primary-source
evidence obtained in the current conversation. Never defend an inferred internal
mechanism as fact — mark it `⚠ unverified`.

If a bug file contains an `⚠ unverified` marker about an external product, the bug
record stands but the claim needs primary-source confirmation before it can be
presented to John as fact. The app UI text carrying that marker is verified; only
the external claim is not.
