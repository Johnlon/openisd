#!/usr/bin/env bash
# T536: every commit land.sh writes passes the global commit-msg hook (agents' subjects must start with
# "(auto) "). Scratch repo, real git, the shared hooks installed as _agent_files/bin/install_githooks.sh does,
# CLAUDECODE=1 in the environment as in an agent session. Paths: uncommitted work, the clean-merge squash onto
# a moved main. A control proves the hook is live.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/land-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
INSTALLER="${INSTALL_GITHOOKS:-$REPO/../_agent_files/bin/install_githooks.sh}"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/land-hook.XXXXXX")"
export OPENISD_RUNTIME_DIR="$SCRATCH/rt" OPENISD_STATE_DIR="$SCRATCH/state"; mkdir -p "$OPENISD_RUNTIME_DIR"
fails=0
trap 'rm -rf "$SCRATCH" "$GITCFG"' EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
[ -f "$INSTALLER" ] || { echo "land-hook: skipped, no $INSTALLER"; exit 0; }

setup() {
    rm -rf "$SCRATCH/w"; mkdir -p "$SCRATCH/w"; cd "$SCRATCH/w" || exit 2
    git init -q --bare -b main origin.git
    git clone -q origin.git c 2>/dev/null; cd c || exit 2
    git config user.email t@t; git config user.name t
    mkdir -p scripts tasks/fixes gates
    cp "$REPO/scripts/land.sh" "$REPO/scripts/paths.sh" scripts/; cp -r "$REPO/scripts/land" scripts/; cp -r "$REPO/scripts/lib" scripts/
    printf '#!/usr/bin/env bash\nexit 0\n' > gates/ok.sh; chmod +x gates/ok.sh
    cat > land.conf <<EOF
LINT_CMD="bash gates/ok.sh"
TYPECHECK_CMD="bash gates/ok.sh"
UNIT_CMD="bash gates/ok.sh"
ARCHITECTURE_CMD="bash gates/ok.sh"
CANDIDATE_CMD="true"
ATTRIBUTION_CMD="bash gates/ok.sh"
GATE_FILES="no-such-gate-file"
GATE_DEADLINE_S=30
LAND_LOCK="$SCRATCH/land.lock"
EOF
    printf 'id: T9\nowner: t\nstatus: claimed\ngoal: Make the thing say what it did.\ndone_test: true\nfiles:\n  - f.txt\n' > tasks/T9.yml
    git add -A; git commit -qm base; git push -q origin main
    bash "$INSTALLER" "$SCRATCH/hooks" "$SCRATCH/w/c" > /dev/null || { echo "land-hook: installer failed"; exit 2; }
}
subjects() { git -C "$SCRATCH/w/origin.git" log --format=%s "$1..main"; }
export CLAUDECODE=1; unset AI_AGENT

# control: the hook is live, a bare "T9: x" from an agent is refused
setup; echo c > f.txt; git add -A
if git commit -q -m "T9: bare" > "$SCRATCH/ctl" 2>&1; then fail "control: hook let a bare subject through"; else ok "control: hook refuses a bare subject"; fi

# 1. uncommitted work
setup; base=$(git rev-parse HEAD); echo change > f.txt
timeout 120 bash scripts/land.sh T9 > "$SCRATCH/out" 2>&1; r=$?
s=$(subjects "$base")
if [ $r = 0 ] && [ "$s" = "(auto) T9: Make the thing say what it did." ]; then ok "uncommitted work lands under the hook"
else fail "uncommitted (r=$r): '$s' $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-200)"; fi

# 2. clean-merge squash onto a moved main
setup; base=$(git rev-parse HEAD)
echo mine > f.txt; git add -A; git commit -q -m "(auto) wip"
git clone -q ../origin.git ../o2; ( cd ../o2 && git config user.email t@t && git config user.name t && echo other > g.txt && git add -A && git commit -q -m "other" && git push -q origin main )
timeout 120 bash scripts/land.sh T9 > "$SCRATCH/out" 2>&1; r=$?
s=$(subjects "$base" | head -n 1)
if [ $r = 0 ] && [ "$s" = "(auto) T9: Make the thing say what it did." ]; then ok "clean-merge squash lands under the hook"
else fail "clean-merge (r=$r): '$s' $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-200)"; fi

[ $fails = 0 ] && { echo "land-hook: all passed"; exit 0; }
echo "land-hook: $fails failed"; exit 1
