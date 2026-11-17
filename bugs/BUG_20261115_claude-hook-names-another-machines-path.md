# BUG_20261115_claude-hook-names-another-machines-path
**Status:** OPEN (found by Codex's review of PR 113, T818)

## Symptom
`.claude/settings.json` has a PreToolUse hook on `Bash|Monitor|Edit|Write|MultiEdit|NotebookEdit` that runs
`/usr/bin/python3 /home/john/work/winisd/_agent_files/bin/run_gates.py PreToolUse`. The path is the other machine's home
(`/home/john`; this machine is `/home/johnl`), so on any machine or runner without that file python exits 2 and a PreToolUse
hook that exits 2 blocks the tool call.

## Observed
- GitHub runner: the file is absent. Reproduced locally with a scratch project holding the same hook pointing at a missing
  script: `claude -p` reports "PreToolUse:Bash hook error ... can't open file" and the Bash call does not run; with
  `--settings '{"disableAllHooks":true}'` the same call runs.
- This machine: `/home/john/...` does not exist, and `_agent_files/bin/run_gates.py` is not in the workspace
  `_agent_files/bin` either (checked 15 Nov 2026), so local sessions here would be blocked the same way unless their
  hooks come from elsewhere.

## Handling
T818 does not touch the hook (standing rule: gates and hook configs are never damaged). The two review workflows switch hooks off
in their own runner session (`settings` input and `--settings`, with a test). The hook itself needs an owner decision: a
repo-relative or `$CLAUDE_PROJECT_DIR` path (rule: committed files use repo-relative paths) and the script committed where
the path points. Left open.
