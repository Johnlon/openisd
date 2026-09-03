---
paths:
  - "**/*.md"
---

# Markdown

**No history in any `.md` file** except `LOG.md`. No "As of \<date\>", no "what was removed", no
closed `[x]` records, no "previously this was called". Documentation states current knowledge
only; git history records what changed.

`LOG.md` is the one exception: it records the **value** of changes. Benefit first in plain
language, then tersely how it was delivered. One line per benefit, grouped by day
(`## YYYY-MM-DD — <terse factual tag>`), newest first. Append at end of session; skip pure churn.

Links: relative in repo `.md` files; `http://localhost:8000/winisd/openisd/...` (with `?html`
before a line anchor) in replies to the user. Never `file://`.

After writing or editing any `.md` with tables, run `npx prettier --write <file>`.
