# BUG_20261017_post-land-red-step-noise-and-lost-output

**Status:** FIXED (T293)

## Symptom
A red post-land run (9a5062a2da, F49) logged:
- `fatal: ..: '..' is outside repository at '/tmp/post-land-fix…'` twice;
- a rejected push with five `hint:` lines, then "opened F49" on the next attempt.

The suite's whole output was gone after the run. The F kept only the failing lines and the last 40.

## Cause
- **'..':** git leaves a rejected ref out of the pre-push hook's input, so the list can be empty. Both
  pre-push hooks (the shared one in `_agent_files/githooks`, and `scripts/hooks-local/pre-push`) still
  looped once over the blank line and ran `git rev-list ..`.
- **Rejected push:** a landing pushed between post-land's fetch and its push of the F. The retry already
  recovered; only its output was noise.
- **Lost output:** the suite's output file is temporary and is removed when the run ends.

## Fix
- Both pre-push hooks skip a blank ref line. The shared hook was fixed in the winisd repo (a92aaaa) and
  reinstalled.
- The red step pushes quietly. A lost race prints "push of the fixes task lost a race with another push
  (attempt n of 3); retrying". git's own text is printed only if all three attempts fail.
- A red run's whole output is kept as `build/test-logs/post-land-red-<sha>.log`, and the F names it
  (`full_output:`).
- Test: `scripts/land/test/post-land-red-base.test.sh` case 4. Origin refuses the first push: one retry
  line, no git noise, the F lands, and the whole output is kept and named.
