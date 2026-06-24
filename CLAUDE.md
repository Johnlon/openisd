# Claude Code rules for this project

## Shell commands
- Always use the **Bash** tool for shell commands. Never use PowerShell.

## Reading context
- Read all `README.md` files in the repository before starting any task — they contain agent instructions and context for each directory.

## UI rules
- Every `<button>` and every nav-like interactive element (toggles, chips, icon-only controls) **must** have a `title` attribute with a plain-English description of what it does. No exceptions.
- Tooltip text should explain the *effect*, not just restate the label — e.g. `title="Set to 2.83V — IEC 60268-5 sensitivity standard"` not `title="2.83V button"`.
- **WinISD cross-reference rule:** Every tooltip, label, doc section, and default value should mention the WinISD equivalent wherever one exists — the parameter name WinISD uses, its default value, where it appears in the WinISD UI, and any known difference in behaviour. Users migrate from WinISD; they need to map Resonate concepts to what they already know. Examples: `"WinISD default: 10"`, `"called 'Driver input voltage' in WinISD"`, `"WinISD shows this in the Box tab → Advanced→ popup"`.

## Third-party tool behaviour — require evidence
- Never assert facts about how third-party tools (WinISD, LEAP, REW, etc.) behave internally without primary-source evidence: documentation, source code, or directly observed test output.
- Inferred or assumed behaviour **must** be labelled as such in code comments, docs, and conversation. Record assumptions in `WINISD.md` (or the relevant tool's notes file) with an explicit "⚠ Assumption — NOT directly verified" marker and a verification procedure.
- Example violation to avoid: stating "WinISD uses 2.83 V fixed" without citing where this was confirmed.
