#!/usr/bin/env python3
"""openisd gates — checks run by `_agent_files/bin/run_gates.py` on every Claude Code hook event.

Contract (see that runner): argv[1] = event, argv[2] = tool name, stdin = the raw hook payload.
Exit 0 passes; non-zero blocks the tool call and shows stderr to the agent.

PreToolUse / Bash: NO AD-HOC TEST RUNNER. A test run goes through `scripts/test.sh` (unit or
browser specs, targeted, quiet, worker-capped) or `scripts/quiet-test.sh`; the full suite runs
only inside the pre-commit hook and `scripts/health-check.sh`. A bare `npx vitest run`,
`vitest`, `npx playwright test`, `npm test` or `npm run test:unit` typed by an agent is blocked
(John, 2026-09-29: "prohibit ad-hoc npx vitest run etc, provide only compliant test scripts and
mandate their usage" — uncapped runs from several sessions pushed the load average to 26 on 10
cores and timed the suites out).
"""
from __future__ import annotations

import json
import re
import sys

COMPLIANT = re.compile(r"scripts/(test|quiet-test|health-check|test-browser)\.sh|\bgit\s+commit\b")
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


def check_bash(command: str) -> int:
    if not BARE_RUNNER.search(command) or COMPLIANT.search(command):
        return 0
    print(
        "openisd gate: ad-hoc test runner blocked.\n"
        "  Run targeted specs through the compliant script, which caps workers by load and\n"
        "  prints only failures:\n"
        "    bash scripts/test.sh packages/design/test/engine/foo.test.ts\n"
        "    bash scripts/test.sh packages/ui/test/ui/foo.browser.spec.ts\n"
        "  The full suite runs only in the pre-commit hook and scripts/health-check.sh.\n"
        "  Rule: .claude/rules/verify.md.",
        file=sys.stderr,
    )
    return 1


def main() -> int:
    event = sys.argv[1] if len(sys.argv) > 1 else ""
    tool = sys.argv[2] if len(sys.argv) > 2 else ""
    payload = sys.stdin.read() if not sys.stdin.isatty() else ""
    if event == "PreToolUse" and tool == "Bash":
        return check_bash(command_of(payload))
    return 0


if __name__ == "__main__":
    sys.exit(main())
