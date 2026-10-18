# BUG_20261018_land-pr-title-over-256

**Status:** FIXED by T410: scripts/land/pr-title.sh (title cut at 256 with an ellipsis, whole goal in the PR body), pinned by scripts/land/test/pr-title.test.sh

## Symptom
`bash scripts/land.sh T398` (18 Oct 2026, 17:20Z): every fast gate passed, then "REFUSED by gate pull-request: GitHub did
not open the pull request for land/T398". gh: "GraphQL: Title is too long (maximum is 256 characters)".

## Cause
`scripts/land.sh:320` passes `"$ID: $goal"` as the pull request title, and the whole task goal goes into it. T398's goal
is several hundred characters. Every task whose goal is over about 250 characters is refused at this gate, whatever
its content.

## Fix
land.sh builds a title of 256 characters or fewer (for example the goal's first sentence, cut at a word), and keeps the
whole goal in the pull request body. A test in `scripts/land/test/` lands a task with a 1000-character goal.

## Verification
`bash scripts/land.sh T398` opens its pull request.
