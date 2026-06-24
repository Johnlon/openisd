# Claude Code rules for this project

## Shell commands
- Always use the **Bash** tool for shell commands. Never use PowerShell.

## Reading context
- Read all `README.md` files in the repository before starting any task — they contain agent instructions and context for each directory.

## Third-party tool behaviour — require evidence
- Never assert facts about how third-party tools (WinISD, LEAP, REW, etc.) behave internally without primary-source evidence: documentation, source code, or directly observed test output.
- Inferred or assumed behaviour **must** be labelled as such in code comments, docs, and conversation. Record assumptions in `WINISD.md` (or the relevant tool's notes file) with an explicit "⚠ Assumption — NOT directly verified" marker and a verification procedure.
- Example violation to avoid: stating "WinISD uses 2.83 V fixed" without citing where this was confirmed.
