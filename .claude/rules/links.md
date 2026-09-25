---
description: Formatting rules for file links and URLs
globs: *
---
# Communication & Links
- CLARITY VIA REFERENCES: Always provide explicit, clickable links or URLs so the user can instantly click to review source files or logs.
- HTTP LINKS ARE THE DEFAULT: ONLY translate paths that are mounted in the server. Mounted paths under `/home/john/work/winisd/` (excluding hidden/dotfile segments) MUST be formatted as `http://localhost:8000/winisd/XXX` (e.g., `[filename](http://localhost:8000/winisd/openisd/path/to/file#L123-145)`).
- Never route unmounted paths or paths containing dotfile segments (e.g. `.claude/`, `.agents/`) through the HTTP server — the server returns HTTP 403.
- Fallback for unmounted files or dotfile paths: use Windows-compatible UNC syntax (`[filename](file://wsl.localhost/Ubuntu-22.04/absolute/path/to/file#L123-145)`).
- For running application screens, use `http://localhost:PORT/path` links.
- Never output plain-text file paths when a clickable link can be provided.
