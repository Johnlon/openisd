# BUG_20261009_land-commit-subject-says-work-in-progress

**Status:** OPEN. Fix is a land.sh task (lots writes the task file), test first.

There are two things, the commit a worker makes and the commit land.sh makes. `scripts/land.sh`
step 1 commits whatever is uncommitted with the fixed subject `<id>: work in progress, committed by
land.sh` (`scripts/land.sh`, "1. commit everything"). Every commit on main from tonight's landings
says that, so `git log` on main tells nothing about what landed.

We need: the landed commit's subject is the task's `goal:` (`<id>: <goal>`), taken from the task
file. A worker's own commits keep their own subjects; only the commit land.sh itself makes, and a
landing with nothing uncommitted makes none.

Test: scratch repo, task file with `goal: X`, uncommitted change, land; the new commit's subject
is `T<n>: X`.
