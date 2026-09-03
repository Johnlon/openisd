---
paths:
  - "scripts/**"
---

# Scripts

Environment is WSL2 on Windows 11; scripts must also work under Windows Git Bash. PowerShell and
cmd are not supported. Do not hardcode `taskkill`, `tskill`, `ps -W` or `netstat -ano` without a
POSIX branch; resolve `python` vs `python3`.

Every new script carries this guard immediately after `set -euo pipefail`:

```bash
{ [ -n "${MSYSTEM:-}" ] || grep -qi microsoft /proc/version 2>/dev/null; } || { echo "ERROR: must run in Git Bash on Windows or WSL, not PowerShell/cmd" >&2; exit 1; }
```

Build a reusable script rather than an inline one-liner for anything recurring. Check `scripts/`
first.

| Script | Purpose |
| --- | --- |
| `start-http.sh` | Vite dev on 4000: health-check, kill port, start in bg, PID to `.server-4000.pid` |
| `stop-http.sh` | Stop the server on 4000 |
| `kill-http.sh [port …]` | Kill processes on ports. Never call ad-hoc |
| `preview-4000.sh` | Kill 4000–4005, start `vite preview` on 4000 |
| `build-release.sh` | Production dist build (`GITHUB_PAGES=true`). Release workflow only |
| `health-check.sh` | Lint, typecheck, unit tests, browser tests |
| `archive-bugs.py` | Move closed bugs to `bugs/archive/` and stage them |
