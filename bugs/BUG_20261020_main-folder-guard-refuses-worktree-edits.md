# Main-folder edit guard refuses edits in worktrees

**Status:** FIXED (T478)

## What happened
The guard added by T476 refused `cd /home/john/work/winisd/openisd-t450 && sed -i …` from a session
whose working folder is the main folder. Two causes: it judged a Bash command by the session's
folder and ignored a leading `cd`; and it matched the main folder's path as text, so
`/home/john/work/winisd/openisd-t450` counted as inside `/home/john/work/winisd/openisd`. Every
session started in the main folder was blocked from in-place edits in its own worktrees.

## Fix
A Bash in-place edit hits the main folder when a path it names is inside it (compared by whole
path components), or, naming no other path, when it runs there (a leading `cd X &&`, else the
session folder). Test: scripts/land/test/main-folder-edit-guard.test.sh, four new cases.
