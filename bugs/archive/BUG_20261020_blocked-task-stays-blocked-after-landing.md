# BUG_20261020_blocked-task-stays-blocked-after-landing

**Status:** FIXED (T499, opi). Found 20 Oct 2026 while closing old tasks for fable.

A task that land.sh once marked `blocked` (rebase conflict) kept `status: blocked` after it later landed. land.sh marks a task done only from open, claimed or todo, and the next-landing sweep skipped blocked tasks too. Ten tasks on main (T116, T218, T239, T271, T296, T323, T393, T398, T403, T412) had landed and still said blocked.

**Fix:** `task_mark_done` (`scripts/land/core/task.sh`) also turns blocked into done and drops `blocked_reason`; land.sh's own-task mark and the sweep both take blocked. The sweep in T499's landing closes the ten. Test: `scripts/land/test/land-squash.test.sh` case g.
