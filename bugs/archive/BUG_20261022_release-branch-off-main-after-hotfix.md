# BUG_20261022_release-branch-off-main-after-hotfix

**Status:** FIXED (T571)

## Symptom
opi, 22 Oct 2026: hotfix 7.0.952 was cut on top of 7.0.951 (539cab244), so its commit 965244774 sits only on origin/release; main has the same fix as its own commit (4a82c28f8). Promoting any main snapshot with `scripts/release.sh --public` published the GitHub release, then failed at `git push origin "$SHA:refs/heads/release"` (not a fast-forward). The release was live, `release` had not moved, and RELEASES.md got no row.

## Cause
release.sh published first (tag push, `gh release edit ... --latest`) and only then pushed `release`, always as a plain push of the snapshot commit. That push is only a fast-forward when `release` is an ancestor of the snapshot.

## Fix
`scripts/release.sh` works out the move of `release` before any outward step and dry-runs the push:
- `release` already contains the snapshot: nothing.
- `release` is an ancestor: push the snapshot (fast-forward).
- otherwise: push a merge commit (tree of the snapshot, parents old release tip and snapshot), which is a fast-forward and keeps the hotfix history. Never a force-push.
The real push comes right after the publish step. The tag v<stamp> stays on the snapshot commit.

## Verification
`bash scripts/quiet-test.sh bash scripts/land/test/release.test.sh` (scratch repo cases: plain fast-forward, hotfix only on release, already contained).
