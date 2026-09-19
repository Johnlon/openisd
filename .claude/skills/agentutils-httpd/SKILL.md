# AgentUtils HTTPD

- Service source: `/home/john/work/agentutils/httpd/`.
- HTTP document service: `http://localhost:8000` (port 4000 is the OpenISD app).
- Usage spec (read before building a URL): `/home/john/work/agentutils/specs/SPEC_HTTPD.md`.
- Mounts: `/winisd` → `/home/john/work/winisd`, `/agentutils` → `/home/john/work/agentutils`,
  `/agentutils-os` → `/home/john/work/agentutils-os`, `/spec-learning` → `/home/john/work/spec-learning`,
  `/agy-brain` → `/home/john/.gemini/antigravity-cli/brain`,
  `/claude-postmortems` → `/home/john/.claude/postmortems`, `/claude` → `/home/john/.claude` (allow-list).
- URL forms: code `…/path/file.ts#L30-L45`; markdown rendered page ALWAYS `…/path/doc.md?html#L30` (no `?html` = raw markdown).
- Emit exactly one clickable markdown link `[label](url)`; never `name (url)`.
- Check `serve_routes.py` for other mounts before inventing a file URL.