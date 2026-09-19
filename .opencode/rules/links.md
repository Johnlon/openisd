---
description: Formatting rules for file links and URLs
globs: *
---
# Communication & Links
- CLARITY VIA REFERENCES: Always provide explicit, clickable links so the user can instantly click to review source files or logs.
- HTTP LINKS ARE THE DEFAULT: serve every file/doc you mention through the local agentutils HTTPD on port 8000.
  - Server: `/home/john/work/agentutils/httpd/` — base `http://localhost:8000`. Usage spec: `/home/john/work/agentutils/specs/SPEC_HTTPD.md`.
  - Translate the file's real absolute path to a URL via the mount table there: this repo is `/winisd/openisd/...`, `/agentutils` → `/home/john/work/agentutils`, etc.
  - Code: `[packages/design/src/index.ts](http://localhost:8000/winisd/openisd/packages/design/src/index.ts#L30-L45)`
  - Markdown rendered page: ALWAYS add `?html` before the anchor (no `?html` = raw markdown):
    `[CLAUDE.md](http://localhost:8000/winisd/openisd/CLAUDE.md?html#L12)`
  - Emit exactly ONE clickable markdown link `[label](url)` — never a bare path, never `a/b/x.ts (http://localhost:8000/...)`, never an invented or censored URL.
- Fallback only when the file is outside every mount: use Windows-compatible UNC syntax (e.g., `[filename](file://wsl.localhost/Ubuntu-22.04/absolute/path/to/file#L123-145)`).
- For running application screens, use `http://localhost:PORT/path` links.
- Never output plain-text file paths when a clickable link can be provided.