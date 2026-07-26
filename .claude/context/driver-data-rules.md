# Driver data rules

## Human-verified flag rules

These rules apply to all `openisd.yml` sidecar fields and any commentary written into driver data files.

- **NEVER write "human verified", "human-verified", "verified by human", or any equivalent phrase** in any sidecar field (`corrections`, `detail`, `reviewed_by`, or any other field) unless the user has **explicitly granted permission in this conversation**.
- The only valid trigger is the user saying something like "mark as human verified" or equivalent explicit instruction addressed to you in this session.
- If you believe the user has reviewed the data and may have forgotten to grant permission, you **may ask once**: _"Would you like me to mark this as human-verified?"_ Do not assume permission; wait for an explicit yes.
- An AI writing that it "confirmed" or "verified" data in `corrections` does NOT count as human verification, even if the AI performed checks.
- `reviewed_by` must remain `null` or unset until the user explicitly authorises it for a specific driver or batch.

## Batch fix SOP

- **Datasheet first, always.** Before applying any automated DQ fix to a WDR field, read the cached datasheet from `drivers/<collection>/datasheets/` and confirm the correct value is there. Never apply a batch fix on pattern alone.
- **Be suspicious of repetition.** If multiple drivers in a family produce identical values, verify each PDF independently — the match may be a regex hitting boilerplate rather than real per-driver data.
- **If the field doesn't exist in the datasheet, don't invent it.** Omit the field and add a `corrections` note in `openisd.yml` explaining why.
- **Record datasheet evidence in `corrections`.** State what the datasheet says and which file it came from. This lets a future reviewer verify the fix without re-fetching the PDF.

## PDF sourcing and debugging

- **Cached PDFs are the primary source.** Always try `drivers/<collection>/datasheets/<filename>` first.
- **If no cached PDF, or if pypdf extracts no text:** Search for the PDF using web search with query `pdf <Brand> <Model>`. Scan results for a direct PDF link, preferring the manufacturer's own site. If no manufacturer PDF is found, accept a major vendor (Parts Express, Mouser, Digikey). Do not use random or unknown third-party sites.
- **PDF link priority (strict):** manufacturer site PDF > Parts Express / Mouser / Digikey PDF > skip and fall back to human review.
- **Fallback to human review.** If no extractable PDF can be found, use `scripts/verify-vas-tiny.py` — it opens the cached PDF in the local viewer and prompts for the field value.
- **Add DQ post-check.** After writing any fix to a WDR, re-run `check_fields()` and confirm the flag is cleared.

## Search Scope and Directory Scans (HARDENED - ABSOLUTE BANS)

- **ABSOLUTE BAN ON ROOT RECURSIVE GREPS:** Under no circumstances may the agent run `grep_search` on `/home/john/work/winisd/`, `/home/john/work/winisd/openisd/`, `/home/john/work/winisd/winisd_tools/`, or `/home/john/work/winisd/winisd_drivers/` without targeting a single file or using strict, narrow file/directory exclusions. Broad scans are a direct violation of cost and speed limits.
- **ABSOLUTE BAN ON UNSCHEDULED FILE READS:** The agent must never call `view_file` on codebase files during refactoring tasks until it has presented the plan of file changes in chat, listed the exact files, and the user has explicitly replied "proceed".
- **NEVER scan, search, or recursively list the `drivers/` directory** unless explicitly instructed by the user in the active chat turn.
- **Ambiguous queries:** If a user query is ambiguous, broad, or could trigger any file search/list operation, the agent **MUST HALT IMMEDIATELY**. Do not use any tools. Present the query options or request precise file paths directly in the chat, and await user confirmation.
- **Use index/bundle files for lookup:** To find driver information, read *only* the pre-compiled index files (`drivers/index.json` or `packages/ui/src/drivers-bundle.json`). Do not crawl the filesystem.

## Tool and Context Efficiency Rules

- **Enforce Claude-Mem & SQLite first:** For any search or RAG capability across multiple files, the agent must check if `claude-mem` or a local SQLite index is available. Never perform manual file searches or greps when an index or database is present.
- **Proactive Cost Warning:** If a task requires scanning more than 3 files or would consume more than 2,000 tokens of raw file reads, the agent **MUST** warn the user in chat of the estimated token cost and suggest `claude-mem` or local database caching before running the tools.
- **Explicit find/grep commands:** If the human explicitly indicates an search action (e.g., 'find all files containing xxx') or specifies 'use grep to find xxx', the agent **MUST** run `grep` directly. Do not use server-based indexing or complex workflows that consume excessive tokens.
- **Enforce maximum token efficiency:** Always use the most token-efficient solution for any operation. If a fast approach exists that is less token-efficient, present the trade-off to the user first and offer the option. **DO NOT** consume tokens performing analysis to figure out if it is more effective.

