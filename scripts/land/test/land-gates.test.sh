#!/usr/bin/env bash
# The land.sh gate-files check: a diff touching a GATE_FILES glob refuses `gates` unless the task has
# gates_approved: QO<n> and that board item has a thread entry by John. Scratch repo, real git, fake
# gates, its own QUESTIONS_FILE. Not a locked spec.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/land-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/land-gates.XXXXXX")"
fails=0
trap 'rm -rf "$SCRATCH" "$GITCFG"' EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

# setup <task extra lines> <file to change> ; GATE_FILES copied from the real land.conf
setup() {
    rm -rf "$SCRATCH/w"; mkdir -p "$SCRATCH/w"; cd "$SCRATCH/w" || exit 2
    git init -q --bare -b main origin.git
    git clone -q origin.git c 2>/dev/null; cd c || exit 2
    git config user.email t@t; git config user.name t
    mkdir -p scripts tasks/fixes gates
    cp "$REPO/scripts/land.sh" "$REPO/scripts/paths.sh" scripts/; cp -r "$REPO/scripts/land" scripts/; cp -r "$REPO/scripts/lib" scripts/
    # the pull request check's runner (17-23) is on the base unless NO_RUNNER_ON_BASE=1
    [ "${NO_RUNNER_ON_BASE:-0}" = 1 ] || { mkdir -p scripts/ci; cp "$REPO/scripts/ci/contract-from-base.sh" scripts/ci/; }
    # BASE_FILES: more files on the base (24-25), each of three lines so git could pair a rename
    for bf in ${BASE_FILES:-}; do mkdir -p "$(dirname "$bf")"; printf 'one\ntwo\nthree\n' > "$bf"; done
    # BASE_COPY: files copied from this repo onto the base (30)
    for bf in ${BASE_COPY:-}; do mkdir -p "$(dirname "$bf")"; cp "$REPO/$bf" "$bf"; done
    printf '#!/usr/bin/env bash\nexit 0\n' > gates/ok.sh; chmod +x gates/ok.sh
    cat > "$SCRATCH/questions.yml" <<'Q'
questions:
- id: QO1
  title: Gate change for T9
  thread:
  - id: QO1.c1
    by: fable
    text: please approve
  - id: QO1.c2
    by: John
    text: ok
- id: QO2
  title: Gate change for T9
  thread:
  - id: QO2.c1
    by: fable
    text: please approve
- id: QO11
  title: Unrelated item, mentions T90 only
  thread:
  - id: QO11.c1
    by: John
    text: ok
Q
    gate_files="$(grep '^GATE_FILES=' "$REPO/land.conf")"
    cat > land.conf <<CONF
LINT_CMD="bash gates/ok.sh"
TYPECHECK_CMD="bash gates/ok.sh"
UNIT_CMD="bash gates/ok.sh"
ARCHITECTURE_CMD="bash gates/ok.sh"
CANDIDATE_CMD="true"
ATTRIBUTION_CMD="bash gates/ok.sh"
GATE_DEADLINE_S=30
LAND_LOCK="$SCRATCH/land.lock"
POST_LAND_LOCK="$SCRATCH/post.lock"
POST_LAND_RECORD="$SCRATCH/post.lock"
QUESTIONS_FILE=$SCRATCH/questions.yml
$([ "${NO_BASE_GATE_FILES:-0}" = 1 ] || printf '%s' "$gate_files")
${BASE_CONF_EXTRA:-}
CONF
    printf 'id: T9\nowner: t\nstatus: claimed\nrelease_note: internal\ngoal: Do the thing.\ndone_test: true\nfiles:\n  - f.txt\n%s' "${1:-}" > tasks/T9.yml
    git add -A; git commit -qm base; git push -q origin main
    mkdir -p "$(dirname "$2")"; echo 1 > "$2"; git add -A; git commit -qm wip
}
land() { timeout 120 bash scripts/land.sh T9 > "$SCRATCH/out" 2>&1; echo $?; }
refused_gates() { [ "$1" = 1 ] && grep -q 'REFUSED by gate gates:' "$SCRATCH/out"; }

setup "" f.txt; r=$(land)
[ "$r" = 0 ] && ok "1 non-gate file lands" || fail "1 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"

setup "" tsconfig.json; r=$(land)
if refused_gates "$r" && grep -q 'tsconfig.json' "$SCRATCH/out" && grep -q 'John approves gate changes' "$SCRATCH/out"; then ok "2 tsconfig.json without field refuses gates"; else fail "2 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"; fi

setup $'gates_approved: QO99\n' tsconfig.json; r=$(land)
refused_gates "$r" && ok "3 QO absent from the board refuses" || fail "3 (r=$r)"

setup $'gates_approved: QO2\n' tsconfig.json; r=$(land)
refused_gates "$r" && ok "4 QO with only agent comments refuses" || fail "4 (r=$r)"

setup $'gates_approved: QO1\n' tsconfig.json; r=$(land)
[ "$r" = 0 ] && ok "5 QO with a by: John entry lands" || fail "5 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"

setup "" packages/ui/coverage-baseline.json; r=$(land)
[ "$r" = 0 ] && ok "6 coverage-baseline.json alone lands" || fail "6 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"

setup "" packages/design/vitest.coverage.config.ts; r=$(land)
refused_gates "$r" && ok "7 packages/design/vitest.coverage.config.ts refuses" || fail "7 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"

setup $'gates_approved: QO11\n' scripts/coverage-x.sh; r=$(land)
refused_gates "$r" && ok "8 John-answered QO that names T90, not T9, refuses" || fail "8 (r=$r)"

setup "" tsconfig.json; sed -i '/^GATE_FILES=/d' land.conf; git add -A; git commit -qm nogf; r=$(land)
if refused_gates "$r" && grep -q 'GATE_FILES is not set in land.conf' "$SCRATCH/out"; then ok "9 unset GATE_FILES refuses"; else fail "9 (r=$r)"; fi

# 10: land.conf and scripts/land.sh are themselves gate files (QO313). Edit = append a comment so the scratch run still works.
for gf in land.conf scripts/land.sh; do
    setup "" f.txt; echo "# edit" >> "$gf"; git add -A; git commit -qm wip2; r=$(land)
    if refused_gates "$r" && grep -q "$gf" "$SCRATCH/out"; then ok "10 $gf without field refuses gates"; else fail "10 $gf (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"; fi
done

# 11: the duplicate check's known-copies list is a gate file (John, 18 Nov 2026, QO948): refused without gates_approved, lands with it.
setup "" scripts/dupscan-allow.json; r=$(land)
if refused_gates "$r" && grep -q 'scripts/dupscan-allow.json' "$SCRATCH/out"; then ok "11 dupscan-allow.json without field refuses gates"; else fail "11 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"; fi

setup $'gates_approved: QO1\n' scripts/dupscan-allow.json; r=$(land)
[ "$r" = 0 ] && ok "12 dupscan-allow.json with a John-answered gates_approved lands" || fail "12 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"

# 13: the duplicate check's homes and the check itself are gate files too (T934 review, Codex 19 Nov 2026: a home declared in
# the proposed change, or an edited scanner, would otherwise pass the check it is meant to tighten).
for gf in scripts/dupscan-homes.json scripts/dupscan.mjs; do
    setup "" "$gf"; r=$(land)
    if refused_gates "$r" && grep -q "$gf" "$SCRATCH/out"; then ok "13 $gf without field refuses gates"; else fail "13 $gf (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"; fi
    setup $'gates_approved: QO1\n' "$gf"; r=$(land)
    [ "$r" = 0 ] && ok "14 $gf with a John-answered gates_approved lands" || fail "14 $gf (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"
done

# 15: the pull request workflow runs the duplicate check and the other gates, so it is a gate file (T934 review 2).
setup "" .github/workflows/pr.yml; r=$(land)
if refused_gates "$r" && grep -q '.github/workflows/pr.yml' "$SCRATCH/out"; then ok "15 .github/workflows/pr.yml without field refuses gates"; else fail "15 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"; fi

# 16: the protected list is the BASE revision's (T934 review 2): a change that drops dupscan-homes.json from GATE_FILES in
# its own land.conf still has its change to dupscan-homes.json named as a gate change.
setup "" scripts/dupscan-homes.json
sed -i 's# scripts/dupscan-homes.json##' land.conf; git add -A; git commit -qm drop-gate; r=$(land)
if refused_gates "$r" && grep -q 'gate files changed: [^;]*scripts/dupscan-homes.json' "$SCRATCH/out"; then ok "16 a gate file dropped from the proposed land.conf is still a gate file (the base list counts)"; else fail "16 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-400)"; fi

# 17-23: the pull request check's gate approval (T934 reviews 3 and 4, Codex 19 Nov 2026: "CI invokes the proposed checker";
# "the task job still executes PR-controlled code before the base-controlled gate"). These run the real run script of pr.yml's
# gate-approval job, read out of .github/workflows/pr.yml, in a scratch clone: it takes the runner from the base commit, and the
# runner runs the base commit's scripts/land/, reading the change's land.conf, task file and file list as data. The land.conf
# here sets QUESTIONS_FILE unquoted, as the real one does.
# ci_step <job> <bootstrap base> <base sha> <head sha>: the last step of that pr.yml job, run as GitHub runs it (its env from
# the yaml, the event's shas given here). ci_contract <bootstrap base>: gate-approval with base origin/main, head HEAD.
ci_step() {
    python3 -c 'import sys, yaml; steps = yaml.safe_load(open(sys.argv[1]))["jobs"][sys.argv[2]]["steps"]; print(steps[-1]["run"])' \
      "$REPO/.github/workflows/pr.yml" "$1" > "$SCRATCH/step.sh" || { echo "no $1 step in pr.yml" > "$SCRATCH/out"; echo 2; return; }
    sums="$(python3 -c 'import sys, yaml; print(yaml.safe_load(open(sys.argv[1]))["jobs"]["gate-approval"]["steps"][-1]["env"]["BOOTSTRAP_SHA256"])' "$REPO/.github/workflows/pr.yml")"
    rm -rf "$SCRATCH/rt"; mkdir -p "$SCRATCH/rt"
    (unset GATE_FILES QUESTIONS_FILE; BASE_SHA="$3" HEAD_SHA="$4" BOOTSTRAP_BASE="$2" BOOTSTRAP_SHA256="$sums" RUNNER_TEMP="$SCRATCH/rt" \
      timeout 300 bash "$SCRATCH/step.sh") > "$SCRATCH/out" 2>&1; echo $?
}
ci_contract() { ci_step gate-approval "$1" "$(git rev-parse origin/main)" "$(git rev-parse HEAD)"; }
# ci_setup <task extra lines> <sabotage 1|0>: setup, then the change: a gate file (tsconfig.json) changed; with sabotage the
# change also edits its own checker, pr-task.sh, pr-setup.sh and runner to pass everything, and its land.conf to run a command.
ci_setup() {
    setup "$(printf '  - tsconfig.json\n  - land.conf\n  - scripts/**\n  - fnmatch.py\n  - packages/**\nwhy: John asked for this change (John, 10 Nov 2026)\n%s' "$1")" f.txt
    if [ "$2" = 1 ]; then
        printf '#!/usr/bin/env bash\nexit 0\n' > scripts/land/check-task-contract.sh
        printf '#!/usr/bin/env bash\necho T1\nexit 0\n' > scripts/land/pr-task.sh
        mkdir -p scripts/ci; printf '#!/usr/bin/env bash\necho "PR_TASK=" >> "$GITHUB_ENV"\nexit 0\n' > scripts/ci/pr-setup.sh
        printf '#!/usr/bin/env bash\nexit 0\n' > scripts/ci/contract-from-base.sh
        printf 'touch "%s/sourced"\n' "$SCRATCH" >> land.conf
    else
        mkdir -p scripts/ci; cp "$REPO/scripts/ci/contract-from-base.sh" scripts/ci/
    fi
    echo 2 > tsconfig.json; echo 2 > f.txt; rm -f "$SCRATCH/sourced"
    printf '\n# the change\n' >> tasks/T9.yml
    git add -A; git commit -qm 'the change'
}
NOT_BASE=0000000000000000000000000000000000000000
ci_setup "" 1; r=$(ci_contract "$NOT_BASE")
if [ "$r" = 1 ] && grep -q $'REFUSE\tgates' "$SCRATCH/out" && grep -q 'tsconfig.json' "$SCRATCH/out"; then ok "17 the change edits its checker, pr-task.sh, pr-setup.sh and runner to pass: the base's scripts still refuse the gate change"; else fail "17 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-400)"; fi
[ "$r" != 2 ] && [ ! -e "$SCRATCH/sourced" ] && ok "18 the proposed land.conf is read as data, never run" || fail "18 the proposed land.conf was run as shell"
ci_setup $'gates_approved: QO1\n' 1; r=$(ci_contract "$NOT_BASE")
[ "$r" = 0 ] && ok "19 the same change with a John-answered gates_approved passes the base's checker" || fail "19 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-400)"
ci_setup $'gates_approved: QO2\n' 1; r=$(ci_contract "$NOT_BASE")
if [ "$r" = 1 ] && grep -q 'board item QO2 has no answer by John' "$SCRATCH/out"; then ok "20 with the board file present (QUESTIONS_FILE unquoted), a gates_approved item John has not answered is refused"; else fail "20 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-400)"; fi
# 21-22: the one reviewed bootstrap. A base without the runner fails closed, unless it is the pinned bootstrap base; there the
# change's own runner and scripts/land/ run (the pull request that adds them).
NO_RUNNER_ON_BASE=1 ci_setup "" 0; r=$(ci_contract "$NOT_BASE")
if [ "$r" = 1 ] && grep -q 'has no scripts/ci/contract-from-base.sh and is not the reviewed bootstrap base' "$SCRATCH/out" && ! grep -q 'REFUSE' "$SCRATCH/out"; then ok "21 a base without the runner, not the pinned bootstrap base, fails closed"; else fail "21 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-400)"; fi
NO_RUNNER_ON_BASE=1 ci_setup "" 0; r=$(ci_contract "$(git rev-parse origin/main)")
if [ "$r" = 1 ] && grep -q $'REFUSE\tgates' "$SCRATCH/out"; then ok "22 on the pinned bootstrap base the change's own runner and checker run, and refuse its unapproved gate change"; else fail "22 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-400)"; fi
# 23: the job runs nothing of the change: no needs, no checkout script run (no "bash scripts/", pr-setup.sh, npm or node), the
# runner run from RUNNER_TEMP; pr-gate needs it; the task job no longer runs the contract.
python3 -c '
import sys, yaml
jobs = yaml.safe_load(open(sys.argv[1]))["jobs"]
job = jobs["gate-approval"]
runs = "\n".join(st.get("run", "") for st in job["steps"])
problems = []
if "needs" in job: problems.append("gate-approval has needs")
for bad in ("bash scripts/", "pr-setup", "npm ", "node ", "./scripts"):
    if bad in runs: problems.append("gate-approval runs " + bad)
if "bash \"$runner\"" not in runs or "runner=\"$RUNNER_TEMP/" not in runs: problems.append("the runner is not run from RUNNER_TEMP")
if "gate-approval" not in jobs["pr-gate"]["needs"]: problems.append("pr-gate does not need gate-approval")
if "contract-from-base" in str(jobs["task"]): problems.append("the task job still runs the contract")
print("; ".join(problems)); sys.exit(1 if problems else 0)
' "$REPO/.github/workflows/pr.yml" > "$SCRATCH/out" 2>&1
[ "$?" = 0 ] && ok "23 pr.yml's gate-approval job runs nothing of the change and pr-gate needs it" || fail "23: $(tr '\n' ' ' < "$SCRATCH/out")"

# 24-25 (T934 review 5): every path the change touches counts, a rename's old path included, and a pattern is matched literally
# (never expanded by the shell against the checkout).
BASE_FILES=scripts/dupscan-homes.json ci_setup "" 0; git mv scripts/dupscan-homes.json scripts/moved-homes.json; git commit -qm move; r=$(ci_contract "$NOT_BASE")
if [ "$r" = 1 ] && grep -q $'REFUSE\tgates\tgate files changed: [^;]*scripts/dupscan-homes.json' "$SCRATCH/out"; then ok "24 a protected file renamed is refused, naming its old path"; else fail "24 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-400)"; fi
BASE_FILES="scripts/coverage-a.sh scripts/coverage-b.sh" ci_setup "" 0; git rm -q scripts/coverage-a.sh; git commit -qm del; r=$(ci_contract "$NOT_BASE")
if [ "$r" = 1 ] && grep -q $'REFUSE\tgates\tgate files changed: [^;]*scripts/coverage-a.sh' "$SCRATCH/out"; then ok "25 a deletion covered by scripts/coverage-*.sh is refused while scripts/coverage-b.sh remains"; else fail "25 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-400)"; fi
# 26-29: the event's commits are checked in both jobs: the checkout must be the head, and the base an ancestor of it.
ci_setup "" 0; other_root="$(git commit-tree "$(git hash-object -t tree /dev/null)" -m orphan)"
for job in gate-approval dupscan; do
    r=$(ci_step "$job" "$NOT_BASE" "$(git rev-parse origin/main)" "$(git rev-parse origin/main)")
    if [ "$r" = 1 ] && grep -q 'the checkout is not' "$SCRATCH/out"; then ok "26 $job refuses a checkout that is not the event's head"; else fail "26 $job (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"; fi
    r=$(ci_step "$job" "$NOT_BASE" "$other_root" "$(git rev-parse HEAD)")
    if [ "$r" = 1 ] && grep -q 'is not an ancestor of' "$SCRATCH/out"; then ok "27 $job refuses a base that is not an ancestor of the head"; else fail "27 $job (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"; fi
done
# 28: the bootstrap exception is bound to content: on the pinned base, a change whose runner is not the reviewed one fails closed.
NO_RUNNER_ON_BASE=1 ci_setup "" 0; printf '\n# edited\n' >> scripts/ci/contract-from-base.sh; git commit -qam edit; r=$(ci_contract "$(git rev-parse origin/main)")
if [ "$r" = 1 ] && grep -q 'bootstrap: scripts/ci/contract-from-base.sh is not the reviewed content' "$SCRATCH/out" && ! grep -q 'REFUSE' "$SCRATCH/out"; then ok "28 on the pinned bootstrap base, an edited runner fails closed"; else fail "28 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-400)"; fi
NO_RUNNER_ON_BASE=1 ci_setup "" 0; printf '\n# edited\n' >> scripts/land/core/task.sh; git commit -qam edit; r=$(ci_contract "$(git rev-parse origin/main)")
if [ "$r" = 1 ] && grep -q 'bootstrap: scripts/land/core/task.sh is not the reviewed content' "$SCRATCH/out"; then ok "28 on the pinned bootstrap base, an edited checker library fails closed"; else fail "28 core (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-400)"; fi
# 29: the yaml bindings, for both events and both jobs: BASE_SHA is the pull request's base sha or the merge group's base sha,
# HEAD_SHA and the checkout are github.sha (the pull request's merge commit; the merge group's head); the dupscan job runs
# nothing of the change before the scan (no needs, no bash scripts/, npm ci only in RUNNER_TEMP) and compares with BASE_SHA;
# pr-gate needs it and the architecture job no longer scans.
python3 -c '
import sys, yaml
d = yaml.safe_load(open(sys.argv[1]))
on = d.get("on", d.get(True))
jobs = d["jobs"]; problems = []
if "pull_request" not in on or "merge_group" not in on: problems.append("pr.yml does not run on pull_request and merge_group")
for name in ("gate-approval", "dupscan"):
    job = jobs[name]; step = job["steps"][-1]; env = step.get("env", {})
    if env.get("BASE_SHA") != "${{ github.event.pull_request.base.sha || github.event.merge_group.base_sha }}": problems.append(name + " BASE_SHA binding: " + str(env.get("BASE_SHA")))
    if env.get("HEAD_SHA") != "${{ github.sha }}": problems.append(name + " HEAD_SHA binding: " + str(env.get("HEAD_SHA")))
    co = [st for st in job["steps"] if str(st.get("uses", "")).startswith("actions/checkout")]
    if len(co) != 1 or co[0].get("with", {}).get("ref") != "${{ github.sha }}" or co[0].get("with", {}).get("fetch-depth") != 0: problems.append(name + " checkout is not github.sha with full history")
    if "needs" in job: problems.append(name + " has needs")
    runs = "\n".join(st.get("run", "") for st in job["steps"])
    for bad in ("bash scripts/", "pr-setup", "./scripts", "npm run"):
        if bad in runs: problems.append(name + " runs " + bad)
    if name not in jobs["pr-gate"]["needs"]: problems.append("pr-gate does not need " + name)
runs = jobs["dupscan"]["steps"][-1]["run"]
if "(cd \"$tools\" && npm ci --ignore-scripts" not in runs or runs.count("npm ci") != 1: problems.append("dupscan installs other than with npm ci --ignore-scripts in RUNNER_TEMP")
if "git show \"$BASE_SHA:package-lock.json\"" not in runs: problems.append("dupscan does not install from the base lockfile")
if "--base \"$BASE_SHA\"" not in runs or "origin/main" in runs: problems.append("dupscan does not compare with BASE_SHA")
if "dupscan" in str(jobs["architecture"]): problems.append("the architecture job still scans")
if "ln -s" in runs or "node \"$tools/dupscan.mjs\"" not in runs or "git show \"$HEAD_SHA:scripts/dupscan.mjs\" > \"$tools/dupscan.mjs\"" not in runs: problems.append("dupscan does not run the scanner staged beside the trusted node_modules")
for st in jobs["gate-approval"]["steps"]:
    if "python3" in st.get("run", "") and "python3 -I" not in st["run"]: problems.append("gate-approval runs python3 without -I")
print("; ".join(problems)); sys.exit(1 if problems else 0)
' "$REPO/.github/workflows/pr.yml" > "$SCRATCH/out" 2>&1
[ "$?" = 0 ] && ok "29 pr.yml binds both jobs to the event's base sha and github.sha for pull_request and merge_group, and the dupscan job runs nothing of the change first" || fail "29: $(tr '\n' ' ' < "$SCRATCH/out")"

# 30 (T934 review 6): the dupscan job loads only the base's trusted typescript and jscpd: a checkout carrying its own
# node_modules/typescript and scripts/node_modules/typescript (each throws when loaded) is scanned as usual, through the ratchet.
# The base has the real package.json and package-lock.json (npm ci, scripts off, needs the npm registry or its cache).
BASE_COPY="package.json package-lock.json scripts/dupscan.mjs" ci_setup "" 0
mkdir -p packages/design/engine; printf 'export const area = (w: number, h: number): number => w + h;\n' > packages/design/engine/clean.ts
echo '{}' > scripts/dupscan-allow.json; echo '{}' > scripts/dupscan-homes.json; echo '{"pairs": {}}' > scripts/dupscan-rekey-T934.json
git add -A; git commit -qm scan; git push -q origin HEAD:main; echo 3 > f.txt; git commit -qam change
for nm in node_modules/typescript scripts/node_modules/typescript; do mkdir -p "$nm"; printf '{"name": "typescript", "version": "0.0.0", "main": "index.js"}\n' > "$nm/package.json"
    printf 'throw new Error("PLANTED typescript from the checkout was loaded");\n' > "$nm/index.js"; done
r=$(ci_step dupscan "$NOT_BASE" "$(git rev-parse origin/main)" "$(git rev-parse HEAD)")
if [ "$r" = 0 ] && grep -q '^dupscan: [0-9]* findings' "$SCRATCH/out" && grep -q 'OK: no new duplicated logic' "$SCRATCH/out" && ! grep -q PLANTED "$SCRATCH/out"; then ok "30 the dupscan job ignores a checkout's own node_modules/typescript and scans through the ratchet"; else fail "30 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | tail -c 400)"; fi
# 31 (T934 review 6): the base's GATE_FILES is read fail-closed: a base land.conf without it refuses, never trusting the change's list alone.
NO_BASE_GATE_FILES=1 ci_setup "" 0; printf 'GATE_FILES="nothing.txt"\n' >> land.conf; git commit -qam list; r=$(ci_contract "$NOT_BASE")
if [ "$r" = 1 ] && grep -q "the base's land.conf .* sets no GATE_FILES" "$SCRATCH/out"; then ok "31 a base land.conf without GATE_FILES refuses"; else fail "31 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-400)"; fi
# 31 (T934 review 7): a base GATE_FILES of whitespace only names no pattern and refuses the same way.
NO_BASE_GATE_FILES=1 BASE_CONF_EXTRA='GATE_FILES="   "' ci_setup "" 0; sed -i 's/^GATE_FILES="   "$/GATE_FILES="nothing.txt"/' land.conf; git commit -qam list; r=$(ci_contract "$NOT_BASE")
if [ "$r" = 1 ] && grep -q "the base's land.conf .* sets no GATE_FILES" "$SCRATCH/out"; then ok "31 a base land.conf whose GATE_FILES is only spaces refuses"; else fail "31 spaces (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-400)"; fi
# 32 (T934 review 6): the checker's Python runs isolated (-I): a fnmatch.py in the checkout that matches nothing is not imported.
ci_setup "" 0; printf 'def fnmatchcase(name, pat):\n    return False\n' > fnmatch.py; git add -A; git commit -qm planted; r=$(ci_contract "$NOT_BASE")
if [ "$r" = 1 ] && grep -q $'REFUSE\tgates\tgate files changed: [^;]*tsconfig.json' "$SCRATCH/out"; then ok "32 a checkout-local fnmatch.py is not imported by the checker"; else fail "32 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-400)"; fi

[ $fails = 0 ] && { echo "land-gates: all passed"; exit 0; }
echo "land-gates: $fails failed"; exit 1
