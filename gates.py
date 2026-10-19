#!/usr/bin/env python3
"""openisd gates — checks run by `_agent_files/bin/run_gates.py` on every Claude Code hook event.

Contract (see that runner): argv[1] = event, argv[2] = tool name, stdin = the raw hook payload.
Exit 0 passes; non-zero blocks the tool call and shows stderr to the agent.

PreToolUse / Bash: NO AD-HOC TEST RUNNER. A test run goes through `scripts/test.sh` (unit or
browser specs, targeted, quiet, worker-capped) or `scripts/quiet-test.sh`; the full suite runs
only in the post-land run. A bare `npx vitest run`,
`vitest`, `npx playwright test`, `npm test` or `npm run test:unit` typed by an agent is blocked
(John, 2026-09-29: "prohibit ad-hoc npx vitest run etc, provide only compliant test scripts and
mandate their usage" — uncapped runs from several sessions pushed the load average to 26 on 10
cores and timed the suites out).

PreToolUse / Edit, Write, NotebookEdit, and Bash `sed -i` / `perl -i`: NO EDIT IN THE MAIN FOLDER (T476).
The main folder is kept at the last green commit by `scripts/land/sync-main-folder.sh`; an edit made there
is stray work. All work happens in a worktree (`scripts/new-task.sh`). This gate fires only when the
repo it runs for IS the main folder (git config `openisd.mainFolder`); a worktree never trips it. Ignored
output (`build/`, `node_modules/`) is allowed. The sync script and `land.sh` are not tool calls, so they are
never blocked.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys

COMPLIANT = re.compile(r"scripts/(test|quiet-test|test-browser)\.sh|\bgit\s+commit\b")
# A runner as the FIRST word of a command segment (after ;, &&, |, ( or the start), allowing env
# assignments, `timeout N`, `time`, `env` and a package-manager prefix before it. A runner named
# elsewhere — `ls playwright.config.js`, `grep vitest foo` — is not a run.
SEGMENT_START = r"(^|[;&|(`]\s*)(\w+=\S*\s+|timeout\s+\S+\s+|time\s+|env\s+)*"
BARE_RUNNER = re.compile(
    SEGMENT_START + r"(npx\s+|pnpm\s+|yarn\s+)?(vitest(\s|$)|playwright\s+test\b)"
    + "|" + SEGMENT_START + r"npm\s+(run\s+)?test(:unit|:crosscheck)?(\s|$)"
)


def command_of(payload: str) -> str:
    try:
        data = json.loads(payload)
    except ValueError:
        return ""
    tool_input = data.get("tool_input") if isinstance(data, dict) else None
    command = tool_input.get("command") if isinstance(tool_input, dict) else None
    return command if isinstance(command, str) else ""


EDIT_TOOLS = ("Edit", "Write", "NotebookEdit", "MultiEdit")
IN_PLACE = re.compile(SEGMENT_START + r"(sed\s+(-\S*\s+)*-\S*i|perl\s+(-\S*\s+)*-\S*i)")
MAIN_FOLDER_MESSAGE = "Edit in a worktree (scripts/new-task.sh), never in the main folder."
ALLOWED_TOP = ("build", "node_modules")


def main_folder() -> str:
    """This gate's repo when it is the main folder, else an empty string."""
    repo = os.path.realpath(os.environ.get("GATES_REPO") or os.path.dirname(os.path.abspath(__file__)))
    out = subprocess.run(["git", "-C", repo, "config", "--get", "openisd.mainFolder"], capture_output=True, text=True)
    return repo if out.returncode == 0 and os.path.realpath(out.stdout.strip()) == repo else ""


def in_main_folder(path: str, base: str, main: str) -> bool:
    full = os.path.realpath(path if os.path.isabs(path) else os.path.join(base, path))
    if full != main and not full.startswith(main + os.sep):
        return False
    return full.split(os.sep)[len(main.split(os.sep))] not in ALLOWED_TOP if full != main else True


def payload_object(payload: str) -> dict:
    try:
        data = json.loads(payload)
    except ValueError:
        return {}
    return data if isinstance(data, dict) else {}


def check_edit(tool: str, payload: str) -> int:
    main = main_folder()
    if not main:
        return 0
    data = payload_object(payload)
    tool_input = data.get("tool_input") if isinstance(data.get("tool_input"), dict) else {}
    cwd = data.get("cwd") if isinstance(data.get("cwd"), str) else main
    if tool in EDIT_TOOLS:
        path = tool_input.get("file_path") or tool_input.get("notebook_path")
        hit = isinstance(path, str) and in_main_folder(path, cwd, main)
    else:
        command = tool_input.get("command") if isinstance(tool_input.get("command"), str) else ""
        hit = bool(IN_PLACE.search(command)) and (in_main_folder(cwd, cwd, main) or main in command)
    if not hit:
        return 0
    print("openisd gate: " + MAIN_FOLDER_MESSAGE, file=sys.stderr)
    return 1


def check_bash(command: str) -> int:
    if not BARE_RUNNER.search(command) or COMPLIANT.search(command):
        return 0
    print(
        "openisd gate: ad-hoc test runner blocked.\n"
        "  Run targeted specs through the compliant script, which caps workers by load and\n"
        "  prints only failures:\n"
        "    bash scripts/test.sh packages/design/test/engine/foo.test.ts\n"
        "    bash scripts/test.sh packages/ui/test/ui/foo.browser.spec.ts\n"
        "  The full suite runs only in the post-land run.\n"
        "  Rule: .claude/rules/verify.md.",
        file=sys.stderr,
    )
    return 1


def main() -> int:
    event = sys.argv[1] if len(sys.argv) > 1 else ""
    tool = sys.argv[2] if len(sys.argv) > 2 else ""
    payload = sys.stdin.read() if not sys.stdin.isatty() else ""
    if event == "PreToolUse" and (tool in EDIT_TOOLS or tool == "Bash"):
        edit = check_edit(tool, payload)
        if edit or tool != "Bash":
            return edit
        return check_bash(command_of(payload))
    return 0


if __name__ == "__main__":
    sys.exit(main())
