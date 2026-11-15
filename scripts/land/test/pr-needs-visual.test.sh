#!/usr/bin/env bash
# T833: scripts/visual/pr-needs-visual.sh decides whether pr.yml's `visual` job runs the visual spec. It answered
# `false` when a UI source AND a later list (the lockfile) both changed (grep -q closed the pipe on the first list, the
# second git diff died of SIGPIPE, pipefail made the pipeline fail, `|| echo false`): PR #127 skipped the visual spec.
# Real git, a scratch repo. A gate that cannot decide must refuse: an unreadable base is a failure, never `false`.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/pnv-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/pnv.XXXXXX")"
trap 'rm -rf "$SCRATCH" "$GITCFG"' EXIT
fails=0
ok() { echo "ok   $1"; }
bad() { echo "FAIL $1"; fails=$((fails + 1)); }

cd "$SCRATCH" && git init -q r && cd r || exit 2
mkdir -p scripts packages/ui/src docs
cp -r "$REPO/scripts/visual" scripts/
echo 1 > packages/ui/src/main.ts; echo 1 > package-lock.json; echo 1 > docs/x.md
git add -A; git commit -qm base; base="$(git rev-parse HEAD)"

# answer <label> <expected>: the script's stdout and exit status at the current HEAD against $base
answer() {
  local label="$1" want="$2" out rc
  out="$(bash scripts/visual/pr-needs-visual.sh merge_group "$base" 2> "$SCRATCH/err")"; rc=$?
  if [ "$rc" = 0 ] && [ "$out" = "$want" ]; then ok "$label -> $want"; else bad "$label: wanted $want with exit 0, got '$out' exit $rc ($(cat "$SCRATCH/err"))"; fi
}
reset() { git reset -q --hard "$base"; }

echo 2 > docs/x.md; git commit -qam docs; answer "a change to nothing relevant" false; reset
echo 2 > packages/ui/src/main.ts; git commit -qam src; answer "a change to a UI source only" true; reset
echo 2 > package-lock.json; git commit -qam lock; answer "a change to the lockfile only" true; reset
echo 2 > packages/ui/src/main.ts; echo 2 > package-lock.json; git commit -qam both; answer "a source and the lockfile" true; reset

# enough changed source paths to fill the pipe (64 KiB) before the second list is written
long="packages/ui/src/$(printf 'd%.0s' {1..40})"; mkdir -p "$long"
for i in $(seq 1 3000); do echo "$i" > "$long/file-$i.ts"; done
echo 2 > package-lock.json; git add -A; git commit -qm "many sources and the lockfile"
[ "$(git diff --name-only "$base" HEAD -- packages/ui/src | wc -c)" -gt 100000 ] && ok "the fixture's source list exceeds the pipe buffer" || bad "fixture too small to fill the pipe"
for n in 1 2 3; do answer "many sources and the lockfile (run $n)" true; done; reset

# a gate that cannot decide refuses: nothing on stdout that reads as an answer, and a non-zero exit
echo 2 > packages/ui/src/main.ts; git commit -qam src
out="$(bash scripts/visual/pr-needs-visual.sh merge_group deadbeefdeadbeefdeadbeefdeadbeefdeadbeef 2> "$SCRATCH/err")"; rc=$?
{ [ "$rc" != 0 ] && [ "$out" != true ] && [ "$out" != false ]; } && ok "an unreadable base fails loudly (exit $rc), it does not answer" || bad "unreadable base: '$out' exit $rc"
out="$(bash scripts/visual/pr-needs-visual.sh merge_group "" 2> "$SCRATCH/err")"; rc=$?
{ [ "$rc" != 0 ] && [ "$out" != true ] && [ "$out" != false ]; } && ok "a missing base fails loudly" || bad "missing base: '$out' exit $rc"
# a failure inside the script (a git error while listing the changes) is a failure too, not `false`
mkdir -p "$SCRATCH/bin"; printf '#!/usr/bin/env bash\ncase " $* " in *" diff "*) echo "fatal: simulated" >&2; exit 128 ;; esac\nexec /usr/bin/env -i PATH="%s" HOME="$HOME" GIT_CONFIG_GLOBAL="$GIT_CONFIG_GLOBAL" GIT_CONFIG_NOSYSTEM=1 git "$@"\n' "$PATH" > "$SCRATCH/bin/git"
chmod +x "$SCRATCH/bin/git"
out="$(PATH="$SCRATCH/bin:$PATH" bash scripts/visual/pr-needs-visual.sh merge_group "$base" 2> "$SCRATCH/err")"; rc=$?
{ [ "$rc" != 0 ] && [ "$out" != true ] && [ "$out" != false ]; } && ok "a git failure while listing the changes fails loudly" || bad "git failure: '$out' exit $rc"

# the workflow must not hide the script's failure inside echo "run=$(...)": an empty answer reads as "not run"
grep -n 'pr-needs-visual.sh' "$REPO/.github/workflows/pr.yml" | grep -v '^[0-9]*: *#' | grep -q 'echo "run=\$(' \
  && bad "pr.yml swallows pr-needs-visual.sh's exit status inside echo \"run=\$(...)\"" || ok "pr.yml takes the script's answer in an assignment, so its failure fails the job"

# the same defect elsewhere: a gate that pipes an unbounded `git diff`/`git log` into `grep -q` (or -vq) answers wrongly when the
# output is longer than the pipe. Read the output into a variable first. (Small `git show <file>` of one file is not covered.)
hits="$(cd "$REPO" && grep -rnE '(git[^|]* (diff|log)[^|]*)\|[^|]*grep +(-[a-zA-Z]+ +)*-[a-zA-Z]*q' scripts .github --include=*.sh --include=*.yml | grep -v '/test/' | grep -vE '^[^:]+:[0-9]+: *#' | grep -v 'Never `list')"
[ -z "$hits" ] && ok "no gate pipes git diff or git log into grep -q" || bad "git diff/log piped into grep -q: $hits"

[ "$fails" = 0 ] && echo "pr-needs-visual: all passed" || { echo "pr-needs-visual: $fails failed"; exit 1; }
