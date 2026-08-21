# `questions.yml` has two entries both titled `id: QO56` — `inbox.py get QO56` silently returns the wrong one

# Status
OPEN

## Symptom

`grep -n "^- id: QO56" questions.yml` returns two lines: 5597 and 5611. The first (5597) is
"Sequencing risk: workspace.ts deletion before its replacement exists" — `status: decided`,
answered 2026-08-18. The second (5611) is "Multiple concurrent sessions are rewriting
overlapping hot files (store.ts, managedProject.ts, openisdDriver.ts, winisdDriver.ts)" —
`status: open`, raised 2026-08-18, the one the standing "OPEN QUESTIONS AWAITING YOUR ACK"
banner actually lists as QO56.

`python3 ~/.claude/bin/inbox.py get QO56` returns the FIRST match (the already-decided
sequencing-risk question) silently — no duplicate-id warning, no indication a second QO56
exists. An agent trying to act on "QO56" from the banner gets the wrong question's full body
and answer, with no signal anything is wrong.

## Cause

Not investigated — likely two ledger-writing sessions (ironically, exactly the class of
collision QO56's own real content warns about) both minted the next id from `next: 56` in the
header before either had persisted its write, so both landed as `id: QO56` instead of one
becoming QO56 and the other QO57.

## Fix

Not applied — reported per bug-first rule, and per the inbox skill's own rule ("Never
hand-edit `questions.yml`; never re-open a markdown TODO.md question list" — only `inbox.py`
may write it). `inbox.py` has no renumber/dedupe verb today. The correct fix needs either a
human running a manual dedupe pass (renumber the second QO56 to the next free id, fix the
`next:` counter, verify no other id collides), or a new `inbox.py` verb to detect and report
duplicate ids safely.

## Verification

Not yet — no fix applied.

Reproduced a SECOND time, on a different id, 2026-08-21: `inbox.py add QO "Coaxial driver..."`
minted `QO62`, but `QO62` was already in use (banner: "29 bundled .wdr files are not UTF-8").
`grep -c "^- id: QO62" questions.yml` → 2. Same class of collision as the QO56 case above, now
confirmed to be a general race in the `next:` counter under concurrent writers, not a one-off.

Reproduced live 2026-08-19: `python3 ~/.claude/bin/inbox.py put QO56 -` (attempting to record
direct evidence of a concurrent-editing collision, ironically) landed the note on the WRONG
QO56 — `inbox.py get QO56` immediately after confirms the note attached to the DECIDED
"Sequencing risk" question, not the OPEN "Multiple concurrent sessions" one it was meant for.
The intended note is now effectively lost from the question it was about. No workaround
attempted (hand-editing questions.yml is banned); this needs the human dedupe pass this bug
already calls for.
