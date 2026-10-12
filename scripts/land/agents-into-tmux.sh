#!/usr/bin/env bash
# Window <name> in tmux session `agents`: created if missing, reused if idle. Prints the window target.
# Exit 1 when a window of that name already runs something other than a shell (two maryus ran at once
# on 10 Oct). Usage: bash scripts/land/agents-into-tmux.sh <name>
set -uo pipefail
NAME="${1:?usage: agents-into-tmux.sh <name>}"
SESSION=agents
tmux has-session -t "$SESSION" 2> /dev/null || tmux new-session -d -s "$SESSION" -n "$NAME" || { echo "cannot create session $SESSION" >&2; exit 2; }
if tmux list-windows -t "$SESSION" -F '#{window_name}' | grep -qxF -- "$NAME"; then
  cmd=$(tmux list-panes -t "$SESSION:=$NAME" -F '#{pane_current_command}' | head -1)
  case "$cmd" in
    bash|zsh|sh|fish|dash|'') ;;
    *) echo "refused: window $SESSION:$NAME is running $cmd; one live session per name" >&2; exit 1 ;;
  esac
else
  tmux new-window -d -t "$SESSION" -n "$NAME" || { echo "cannot create window $NAME" >&2; exit 2; }
fi
echo "$SESSION:$NAME"
