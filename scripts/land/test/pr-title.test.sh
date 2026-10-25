#!/usr/bin/env bash
# scripts/land/pr-title.sh: the pull request title is "<id>: <goal>" and never over 256 characters (T410).
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
export LC_ALL=C.UTF-8
. "$REPO/scripts/land/pr-title.sh"
fails=0
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
eq()   { [ "$2" = "$3" ] && ok "$1" || fail "$1: got '$2', want '$3'"; }
le256(){ [ "${#2}" -le 256 ] && ok "$1 (${#2} chars)" || fail "$1: ${#2} chars, over 256"; }

eq "short goal unchanged"       "$(pr_title T1 "Fix the thing")"  "T1: Fix the thing"
eq "no goal: the id alone"      "$(pr_title T1 "")"               "T1"
eq "newlines become spaces"     "$(pr_title T1 $'a\nb')"          "T1: a b"

exact="$(printf 'x%.0s' $(seq 1 252))"                  # "T1: " is 4 characters, so 252 more make exactly 256
t="$(pr_title T1 "$exact")"; eq "exactly 256 is kept whole" "$t" "T1: $exact"; le256 "exactly 256" "$t"

long="$(for i in $(seq 1 200); do printf 'word%d ' "$i"; done)"       # about 1500 characters
t="$(pr_title T398 "$long")"
le256 "1000+ char goal"         "$t"
case "$t" in "T398: word1 word2 "*) ok "keeps the goal's start" ;; *) fail "start lost: ${t:0:40}" ;; esac
case "$t" in *…) ok "ends in an ellipsis" ;; *) fail "no ellipsis" ;; esac
case "$t" in *" …"|*"word"[0-9]*…) ok "cut at a word boundary" ;; *) fail "cut mid-word: ${t: -20}" ;; esac

one="$(printf 'z%.0s' $(seq 1 600))"                    # no space to cut at
t="$(pr_title T2 "$one")"; le256 "one 600-char word" "$t"

multi="$(printf 'é%.0s' $(seq 1 600))"                  # multibyte: characters, not bytes
t="$(pr_title T2 "$multi")"; le256 "600 multibyte chars" "$t"

# land.sh opens the pull request with this title, and not with the raw goal
grep -q '^\. "\$HERE/land/pr-title.sh"' "$REPO/scripts/land.sh" && ok "land.sh sources pr-title.sh" || fail "land.sh does not source pr-title.sh"
grep -q 'pr.sh" open "\$ID" "\$CANDIDATE_BRANCH" "\$(pr_title "\$ID" "\$goal")"' "$REPO/scripts/land.sh" \
  && ok "land.sh passes pr_title to pr.sh" || fail "land.sh does not pass pr_title to pr.sh"

[ "$fails" -eq 0 ] || { echo "pr-title: $fails failed"; exit 1; }
echo "pr-title: all ok"
