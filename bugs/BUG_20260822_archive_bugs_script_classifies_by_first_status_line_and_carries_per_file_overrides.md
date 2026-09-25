# archive-bugs.py classifies by first status line only and carries per-file overrides

Status: FIXED — classifier rewritten to scan every status line; overrides deleted

## Symptom

`scripts/archive-bugs.py` archives a bug record whose status block opens with a FIXED bullet
even when a later bullet says OPEN. Running it re-creates the over-sweep recorded in
`BUG_20260822_archive_sweep_moved_a_partially_open_bug_breaking_the_parity_suites_uncapturable_citation.md`
(six partially-open records archived; one broke the winisd-parity suite and with it every
non-doc commit).

## Evidence

`is_closed_bug()` (pre-fix): rule 1 reads only the direct `Status:` line; rule 2 reads only
the FIRST non-empty line under a `# Status` header ("if list, check first bullet point" —
its own comment). A block like

    # Status
    - harness dialog handling: FIXED 2026-08-14
    - missing golden for solve-from-mms-cms: OPEN

classifies as closed. Lines 77-87 additionally hard-code five per-file overrides, including
`return False` for the exact file the sweep nevertheless moved. `AGENTS.md:243` documents the
script for future runs, so the defect is durable, not one-shot. Reported by the peer session
`yaml-divergence-wdr-refactor` (2026-08-22); verified by reading the script.

## Cause

The classifier treats the status region's first line as the whole status; multi-line
statuses (one item FIXED, another OPEN) are truncated to their first item. The per-file
overrides paper over individual misclassifications instead of fixing the rule.

## Fix

Rewrite `is_closed_bug()`: gather the direct `Status:` line AND every line under a
`# Status` header (until the next header); a file is closed only if NO gathered line
matches open-indicating terms (OPEN, BLOCKED, DEFERRED, NOT FIXED, IN PROGRESS) AND at
least one gathered line carries a closed keyword (RESOLVED, FIXED, WONTFIX, CLOSED).
Delete the per-file overrides.

## Verification

Classifier probe over the six known partially-open records (all must classify NOT closed)
and a fully-FIXED record (must classify closed) — run below.
