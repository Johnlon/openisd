#!/bin/sh
# Rejects AI attribution in a commit message.
#
# John, 2026-09-23: "NEVER use Co-Authored bu AI". Commits carry John's authorship and
# nothing else — no AI co-author trailer, no session link, no tool advertisement. Agent
# harnesses inject these by default, so the repo enforces it rather than trusting each
# agent to remember.
#
# Reads ONE commit message on stdin. Exit 0 clean, exit 1 with the offending lines named.
#
# Called by scripts/hooks-local/commit-msg (at commit time, the only hook that can see the
# message) and by scripts/hooks-local/pre-push (every commit being pushed, so a commit made
# with --no-verify still cannot reach a remote).

banned=$(cat | grep -n -i -E \
  -e '^[[:space:]]*co-authored-by:.*(claude|anthropic|copilot|cursor|chatgpt|openai|gpt-[0-9]|codex|gemini|devin|aider|bot@)' \
  -e '^[[:space:]]*claude-session:' \
  -e 'generated with \[?claude code' \
  || true)

[ -z "$banned" ] && exit 0

echo "──────────────────────────────────────────────────────────────────────────"
echo "REJECTED: AI attribution in a commit message."
echo
echo "$banned" | sed 's/^/    /'
echo
echo "Commits carry John's authorship and nothing else. Remove the line(s) above:"
echo "  no Co-Authored-By naming an AI, no Claude-Session:, no 'Generated with'."
echo
echo "Amend with:  git commit --amend"
echo "──────────────────────────────────────────────────────────────────────────"
exit 1
