# BUG_20261020_land-rebase-replays-clean-merge

**Status:** FIXED (T498, maryu). Found by bob, 20 Oct 2026.

**Fix:** land.sh puts a branch that merges cleanly with origin/main onto it as one commit with the merged tree before any rebase; tested by land-clean-merge.e2e.test.sh.

There are two ways to bring a task onto origin/main, a merge and a rebase. land.sh only rebases, which replays every commit and can conflict on an old commit even when the merge of the branch with origin/main is clean. We need land.sh to land a branch whose merge is clean.

- Seen: T418's 15 commits were blocked by rebase conflicts three times, though the merge with origin/main was clean.
- Where: `scripts/land.sh`, step 2 (`rebase_onto_main`).
- Test first: a branch that merges cleanly with origin/main, but whose commits replay with conflicts, still lands.
