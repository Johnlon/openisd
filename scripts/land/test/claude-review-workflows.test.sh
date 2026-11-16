#!/usr/bin/env bash
# Claude's automatic reviews keep the constraints they were built with (T818, John 15 Nov 2026). A workflow that holds a
# credential cannot be run before it is on main, so what can be proven without running it is proven here:
#   Part A  the two workflows' shape (events, permissions, the secret only behind the fork/bot guard, a pinned action,
#           limits, a narrow tool list, advisory: not in pr-gate), parsed as YAML;
#   Part B  scripts/ci/claude-review-needed.sh on scratch commits;
#   Part C  scripts/ci/claude-review-verdict.sh with a stand-in for `gh`;
#   Part D  scripts/visual/review-pictures-prep.py on scratch pictures (needs Pillow and numpy; skipped when absent).
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
fails=0
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
eq()   { [ "$2" = "$3" ] && ok "$1" || fail "$1: got '$2', want '$3'"; }

# ---- Part A: the workflows' shape
cd "$REPO" || exit 1
node --input-type=module - "$REPO" <<'JS'
import fs from 'node:fs';
import {parse} from 'yaml';
const repo = process.argv[2];
let bad = 0;
const ok = m => console.log('ok   ' + m);
const fail = m => { console.log('FAIL ' + m); bad++; };
const check = (c, m) => (c ? ok(m) : fail(m));
const read = f => fs.readFileSync(`${repo}/${f}`, 'utf8');
const FILES = {'claude-review.yml': 'review-pull-request', 'claude-review-pictures.yml': 'review-baseline-pictures'};
for (const [file, skill] of Object.entries(FILES)) {
  const text = read(`.github/workflows/${file}`);
  const wf = parse(text);
  const tag = f => `${file}: ${f}`;
  const on = wf.on;
  check(JSON.stringify(Object.keys(on)) === '["pull_request"]', tag('triggers on pull_request and nothing else (no pull_request_target, workflow_run, merge_group, schedule, dispatch)'));
  check(!/pull_request_target|workflow_run|merge_group/.test(text.replace(/^\s*#.*$/gm, '')), tag('names no privileged or queue event outside comments'));
  check(on.pull_request.branches?.join() === 'main', tag('only pull requests into main'));
  check(wf.permissions && Object.keys(wf.permissions).length === 0, tag('top-level permissions block present and empty'));
  check(wf.concurrency?.['cancel-in-progress'] === true && /pull_request\.number/.test(wf.concurrency.group), tag('one run per pull request, a new push cancels the old'));
  const jobs = Object.values(wf.jobs);
  check(jobs.length === 1, tag('one job'));
  const job = jobs[0];
  check(Number.isInteger(job['timeout-minutes']) && job['timeout-minutes'] <= 30, tag('job has a timeout of at most 30 minutes'));
  check(job.permissions?.contents === 'read' && job.permissions?.['pull-requests'] === 'write' && Object.keys(job.permissions).length === 2,
    tag('job permissions are exactly contents: read, pull-requests: write (cannot push, no id-token)'));
  const guard = String(job.if);
  for (const part of ["vars.CLAUDE_REVIEW != 'off'", 'github.event.pull_request.head.repo.full_name == github.repository',
    '!github.event.pull_request.draft', "github.event.pull_request.user.type != 'Bot'", "!endsWith(github.actor, '[bot]')"]) {
    check(guard.includes(part), tag(`job guard has: ${part}`));
  }
  // The secret is read in this job only, by the action step only, as the one input claude_code_oauth_token.
  const refs = [...text.replace(/^\s*#.*$/gm, '').matchAll(/secrets\.([A-Za-z0-9_]+)/g)].map(m => m[1]);
  check(refs.length === 1 && refs[0] === 'CLAUDE_CODE_OAUTH_TOKEN', tag('the only secret named is CLAUDE_CODE_OAUTH_TOKEN, once'));
  for (const s of job.steps) {
    const mentions = JSON.stringify(s).includes('CLAUDE_CODE_OAUTH_TOKEN');
    if (mentions) check(String(s.uses).startsWith('anthropics/claude-code-action@') && s.with?.claude_code_oauth_token === '${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}' && !s.run && !s.env, tag('the secret is only the action step\'s claude_code_oauth_token input, never a run step or env'));
  }
  const claude = job.steps.find(s => String(s.uses).startsWith('anthropics/claude-code-action@'));
  check(!!claude, tag('runs anthropics/claude-code-action'));
  check(/@[0-9a-f]{40}$/.test(claude.uses), tag('the action is pinned to a full commit sha'));
  check(job.steps.filter(s => s.uses && !/@(v\d+|[0-9a-f]{40})$/.test(s.uses)).length === 0, tag('every action is pinned to a version'));
  const w = claude.with;
  check(w.github_token === '${{ github.token }}', tag('the workflow token (limited by permissions) is passed, so the app token is not used'));
  for (const bad of ['allowed_bots', 'allowed_non_write_users', 'show_full_output', 'plugin_marketplaces', 'plugins', 'use_commit_signing'])
    check(!(bad in w), tag(`does not set ${bad}`));
  check(w.prompt.startsWith(`/${skill} `) && fs.existsSync(`${repo}/.claude/skills/${skill}/SKILL.md`), tag(`prompt runs the skill ${skill}, which exists`));
  check(!/\$\{\{\s*github\.event\.pull_request\.(title|body|head\.ref)/.test(w.prompt), tag('no pull request title, body or branch name in the prompt (untrusted text)'));
  const args = String(w.claude_args);
  check(/--max-turns \d+/.test(args) && /--model /.test(args), tag('claude_args has --max-turns and --model'));
  const tools = (args.match(/--allowedTools "([^"]*)"/) || [])[1] || '';
  const list = tools.split(/,(?![^()]*\))/);
  check(list.length > 3, tag('an explicit tool list is given'));
  check(!list.some(t => /^(Edit|NotebookEdit|WebFetch|WebSearch|Bash)$/.test(t) || /^Bash\((git (push|commit|add|checkout|reset|rebase|merge|fetch)|gh (api|pr (merge|edit|close|review|create)|workflow|secret|run))/.test(t)),
    tag('no tool that pushes, merges, edits, calls the API freely or reaches the web'));
  check(list.every(t => /^(Read|Grep|Glob|Write|mcp__github_inline_comment__create_inline_comment|Bash\((git (diff|log|show|blame|rev-parse)|gh pr (view|comment)):\*\))$/.test(t)), tag('every allowed tool is on the known list'));
  // The repository's own hooks must never run in the review session: a hook that names a path of a developer machine exits 2
  // on a runner and blocks every tool call (Codex, PR 113). The hook config stays; the session switches hooks off.
  const settingsJson = JSON.parse(read('.claude/settings.json'));
  const hookCommands = JSON.stringify(settingsJson.hooks ?? {});
  check(w.settings && JSON.parse(w.settings).disableAllHooks === true, tag('the action input settings turns all hooks off for the runner session'));
  check(/--settings '\{"disableAllHooks": true\}'/.test(args), tag('claude_args --settings turns all hooks off (the form tried locally: a failing project hook blocks Bash, this lets it run)'));
  check(!/--setting-sources/.test(args), tag('project settings are still loaded (skills live there)'));
  if (/\/home\//.test(hookCommands)) ok(tag('.claude/settings.json hooks name a /home path, which the two checks above neutralise'));
  const verdict = job.steps.find(s => /claude-review-verdict\.sh/.test(s.run || ''));
  check(!!verdict && /!cancelled\(\)/.test(String(verdict.if)), tag('a verdict step turns Claude\'s verdict into the check colour, also after a failed Claude step'));
}
const pics = parse(read('.github/workflows/claude-review-pictures.yml'));
check(JSON.stringify(pics.on.pull_request.paths) === '["packages/ui/test/visual/visual.browser.spec.ts-snapshots/**"]', 'claude-review-pictures.yml: runs only for a change under the baseline folder');
const pr = parse(read('.github/workflows/pr.yml'));
check(!JSON.stringify(pr.jobs['pr-gate'].needs).includes('claude'), 'pr.yml: pr-gate does not need a Claude job (advisory, never the gatekeeper)');
check(!fs.readdirSync(`${repo}/.github/workflows`).some(f => /^(suite|pr|build|deploy|release|mirror|visual-retake|ci-image)\.yml$/.test(f) && /claude-code-action/.test(read(`.github/workflows/${f}`))), 'no other workflow runs the Claude action');
process.exit(bad ? 1 : 0);
JS
[ $? -eq 0 ] || fails=$((fails + 1))

# ---- scratch repo shared by parts B and D
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
git -C "$T" init -q -b main && git -C "$T" config user.email t@example.invalid && git -C "$T" config user.name t
SNAP=packages/ui/test/visual/visual.browser.spec.ts-snapshots
mkdir -p "$T/$SNAP" "$T/tasks" "$T/src"
echo a > "$T/src/a.ts"; echo t > "$T/tasks/T1.yml"; echo x > "$T/$SNAP/mobile-empty.png"
git -C "$T" add -A && git -C "$T" commit -qm base
base="$(git -C "$T" rev-parse HEAD)"

# ---- Part B: which changes need a code review
need() { git -C "$T" add -A && git -C "$T" commit -qm c && (cd "$T" && bash "$REPO/scripts/ci/claude-review-needed.sh" "$base" HEAD | grep '^run=') ; git -C "$T" reset -q --hard "$base"; }
echo '# notes' > "$T/docs.md"; echo b > "$T/tasks/T2.yml"
eq "documents and task files: no review"        "$(need)" "run=false"
echo y > "$T/$SNAP/mobile-empty.png"
eq "a baseline picture alone: no code review"    "$(need)" "run=false"
echo b >> "$T/src/a.ts"
eq "a source file: review"                       "$(need)" "run=true"
echo '{}' > "$T/package.json"
eq "a configuration file: review"                "$(need)" "run=true"
eq "no change at all: no review"                 "$(cd "$T" && bash "$REPO/scripts/ci/claude-review-needed.sh" "$base" "$base" | grep '^run=')" "run=false"

# ---- Part C: the verdict decides the exit status
bin="$T/bin"; mkdir -p "$bin"
mkfake() { # $1 = JSON lines the fake gh prints
  printf '%s\n' "#!/usr/bin/env bash" "cat <<'J'" "$1" "J" > "$bin/gh"; chmod +x "$bin/gh"; }
verdict() { GH="$bin/gh" bash "$REPO/scripts/ci/claude-review-verdict.sh" o/r 7 code 555 > /dev/null 2>&1; echo $?; }
body() { printf '{"u":"%s","b":%s}' "$1" "$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$2")"; }
mkfake "$(body 'github-actions[bot]' $'<!-- claude-review:code run=555 head=abc -->\nVerdict: CLEAR\nnothing')"
eq "CLEAR passes"                                        "$(verdict)" 0
mkfake "$(body 'github-actions[bot]' $'<!-- claude-review:code run=555 head=abc -->\nVerdict: SKIPPED\nnothing to review')"
eq "SKIPPED passes"                                      "$(verdict)" 0
mkfake "$(body 'github-actions[bot]' $'<!-- claude-review:code run=555 head=abc -->\nVerdict: CONCERNS\none finding')"
eq "CONCERNS turns the check red"                        "$(verdict)" 1
mkfake ""
eq "no comment at all turns the check red"               "$(verdict)" 1
mkfake "$(body 'github-actions[bot]' $'<!-- claude-review:code run=5555 head=abc -->\nVerdict: CLEAR')"
eq "another run's comment (run=5555) is not this run's"  "$(verdict)" 1
mkfake "$(body 'someone' $'<!-- claude-review:code run=555 head=abc -->\nVerdict: CLEAR')"
eq "a comment by someone else is not the verdict"        "$(verdict)" 1
mkfake "$(body 'github-actions[bot]' $'<!-- claude-review:pictures run=555 head=abc -->\nVerdict: CLEAR')"
eq "the other review's comment is not this kind's"       "$(verdict)" 1
mkfake "$(body 'github-actions[bot]' $'<!-- claude-review:code run=555 head=abc -->\nlooks fine to me')"
eq "a comment without a Verdict line turns it red"       "$(verdict)" 1
printf '%s\n' "#!/usr/bin/env bash" "exit 1" > "$bin/gh"
eq "an unreadable pull request turns it red"             "$(verdict)" 1

# ---- Part D: the pictures' mechanical pass
if python3 -I -c 'import PIL, numpy' 2> /dev/null; then
  PY=python3
elif [ -n "${PICTURES_PYTHON:-}" ] && "$PICTURES_PYTHON" -c 'import PIL, numpy' 2> /dev/null; then
  PY="$PICTURES_PYTHON"
else
  PY=""; echo "skip Part D: Pillow and numpy are not installed (the pr.yml shell job installs them)"
fi
if [ -n "$PY" ]; then
  "$PY" - "$T/$SNAP" <<'PYG'
import sys
from PIL import Image, ImageDraw
d = sys.argv[1]
def pic(name, marks):
    im = Image.new("RGB", (390, 844), (250, 250, 250))
    for i, (x, y) in enumerate(marks):
        ImageDraw.Draw(im).rectangle((x, y, x + 80, y + 40), fill=(10 + i * 40, 90, 160))
    im.save(f"{d}/{name}.png")
pic("mobile-empty", [])
PYG
  git -C "$T" add -A && git -C "$T" commit -qm base2 && base2="$(git -C "$T" rev-parse HEAD)"
  "$PY" - "$T/$SNAP" <<'PYG'
import sys
from PIL import Image, ImageDraw
d = sys.argv[1]
def pic(name, marks):
    im = Image.new("RGB", (390, 844), (250, 250, 250))
    for i, (x, y) in enumerate(marks):
        ImageDraw.Draw(im).rectangle((x, y, x + 80, y + 40), fill=(10 + i * 40, 90, 160))
    im.save(f"{d}/{name}.png")
pic("mobile-empty", [(50, 50)])                       # changed
pic("mobile-dialog-a", [(100, 300), (100, 400)])       # new
pic("mobile-dialog-b", [(100, 300), (100, 400)])       # new, byte-identical to a
pic("mobile-dialog-c", [(100, 300), (100, 400)])       # new, differs from a in a tiny area
im = Image.open(f"{d}/mobile-dialog-c.png"); ImageDraw.Draw(im).rectangle((300, 700, 319, 719), fill=(0, 0, 0)); im.save(f"{d}/mobile-dialog-c.png")
PYG
  git -C "$T" add -A && git -C "$T" commit -qm change
  (cd "$T" && "$PY" -I "$REPO/scripts/visual/review-pictures-prep.py" "$base2" HEAD "$T/out") > "$T/prep.log" 2>&1 || { cat "$T/prep.log"; fail "prep ran"; }
  r="$T/out/REPORT.md"
  grep -q 'EXACT DUPLICATE: mobile-dialog-a has the same pixels as mobile-dialog-b' "$r" && ok "an identical pair is reported" || fail "identical pair not reported"
  grep -q 'NEAR DUPLICATE: mobile-dialog-c differs from mobile-dialog-a' "$r" && ok "a near-identical pair is reported" || fail "near pair not reported"
  grep -q 'mobile-empty \[M\] 390x844, [0-9.]*% differs from base' "$r" && ok "a changed picture says how much moved" || fail "change size missing"
  [ -s "$T/out/sheet-01.png" ] && ok "a contact sheet is drawn" || fail "no contact sheet"
fi

[ "$fails" -eq 0 ] && { echo "claude-review-workflows: all ok"; exit 0; }
echo "claude-review-workflows: $fails FAILED"; exit 1
