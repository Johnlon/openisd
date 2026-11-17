# BUG_20261115_pr-visual-job-skipped-when-sources-and-lockfile-both-change

**Status:** RESOLVED (T833)

## Symptom
The pull request gate's `visual` job reported success without running the visual spec on a change that altered four pictures
(T827, PR #127, merged 15 Nov 2026 17:42 UTC; main went red on `f3717906`: `visual mobile dialog-options-your-data`,
`visual desktop dialog-settings-options-your-data`, and the shared storage restore picker on both skins). Its log says
"no UI source, picture, visual spec or test-machine change; the visual spec is not run" although the change touched
`packages/ui/src`, `packages/design/fields` and `package-lock.json`.

## Steps to reproduce
1. In a checkout with history, take a change that alters a file under `scripts/visual/sources.txt` (for example `packages/ui/src/main.ts`)
   and also `package-lock.json`. The pull request T827 at its head `22ea4688`, against `7e371baf`, is one.
2. `bash scripts/visual/pr-needs-visual.sh merge_group 7e371baf5ef10598ddaf0fab3800d6597c753ffa` prints `false`. Expected: `true`.
3. `bash -x` the same call: the last two commands are the two `git diff` calls, then `echo false`.

## Evidence
Run 43742196016 (the merge queue run for T827), job `visual`: `GROUP_BASE: 7e371baf...`, then the "not run" line. Reproduced locally
on the T827 head three times in a row (`false` each time); `git diff --name-only 7e371baf HEAD -- <sources>` lists
`packages/ui/src/...` and `packages/design/fields/...`. The visual_sources_changed output alone is non-empty.

## Cause
`scripts/visual/pr-needs-visual.sh` runs `set -euo pipefail` and ends with
`{ visual_sources_changed ...; git diff ... -- "${extra[@]}"; } | grep -q . && echo true || echo false`.
`grep -q` exits at the first line; the second `git diff` (here `package-lock.json`, which the change touched) then writes to a closed pipe and
dies of SIGPIPE, so under `pipefail` the pipeline's status is nonzero and `|| echo false` runs. The answer is `false` exactly when the sources
changed AND a later list (lockfile, fixtures, visual spec, image) also has output. A change to the sources alone, or to the lockfile alone,
answers `true`. ⚠ the exit status 141 was inferred from the `-x` trace and a reduced reproduction (`{ echo a; seq 1 200000; } | grep -q .` under `pipefail` gives 141);
it was not read from the script's own exit code.

## Fix
Not done here (the task is the re-take). The smallest change: read the whole list before testing it, e.g. `changed="$({ ...; } )"; [ -n "$changed" ] && echo true || echo false`,
or `grep .` to /dev/null instead of `grep -q .`. A test with a change that touches a source and the lockfile would have caught it
(`scripts/land/test/` has none for `pr-needs-visual.sh` with two lists non-empty).

## Verification
`pr-needs-visual.sh` answers `true` for a change touching `packages/ui/src/main.ts` and `package-lock.json`; the `visual` job then runs on such a pull request
and fails a picture that changed.

## Resolution (T833)
Reproduced first with `scripts/land/test/pr-needs-visual.test.sh`: a source and the lockfile answered `false` on the unfixed script (a
source alone and the lockfile alone answered `true`), also with 3000 changed sources filling the pipe. Fixed: each list is read whole into a
variable and then tested; a git failure ends the script with no answer; pr.yml's `visual` job takes the answer in an assignment, so the
script's failure fails the job (inside `echo "run=$(...)"` it had been lost, and an empty answer reads as "not run"). The same shape was
removed from `scripts/integrate.sh` (stored-data corpus gate), `scripts/land/check-task-contract.sh` (`.only(` check, which missed a
`.only(` in a diff longer than the pipe), `scripts/land/pr-task.sh` and pr.yml's `shell` job.
