# Claude Code rules for this project

## Shell commands
- Always use the **Bash** tool for shell commands. Never use PowerShell.

## Reading context
- Read all `README.md` files in the repository before starting any task — they contain agent instructions and context for each directory.

## UI rules
- Every `<button>` and every nav-like interactive element (toggles, chips, icon-only controls) **must** have a `title` attribute with a plain-English description of what it does. No exceptions.
- Tooltip text should explain the *effect*, not just restate the label — e.g. `title="Set to 2.83V — IEC 60268-5 sensitivity standard"` not `title="2.83V button"`.
- **Box type symmetry rule:** Controls that apply to all box types (e.g. box losses, Vb) must appear in a fixed position common to all types — never inside a box-type-specific block. Box-type-specific controls (vent params, PR params, etc.) go in their own conditional blocks below the shared controls. All box types must have the same structural skeleton; only the middle section varies.
- **WinISD cross-reference rule:** Every tooltip, label, doc section, and default value should mention the WinISD equivalent wherever one exists — the parameter name WinISD uses, its default value, where it appears in the WinISD UI, and any known difference in behaviour. Users migrate from WinISD; they need to map Resonate concepts to what they already know. Examples: `"WinISD default: 10"`, `"called 'Driver input voltage' in WinISD"`, `"WinISD shows this in the Box tab → Advanced→ popup"`.
- **Intrinsic vs tunable rule:** Device-intrinsic parameters (datasheet specs that describe what the component *is*) belong inside a collapsible edit section. Tunable parameters (things the user adjusts during design — added mass, box volume, vent length, losses) must stay permanently visible outside any collapsible block so the user can tweak them without entering edit mode.

## Testing rules
- **Direct unit tests required:** Every function in `src/core/` must have direct unit tests in `test/`. Tests are not optional.
- **Human-readable scenarios:** Every test (`it(...)`) must describe its scenario in plain English — what physical situation is being tested and what the expected outcome is. A loudspeaker designer who has never seen the code must be able to read a test name and understand what it verifies.
- **No magic numbers in tests:** Every numeric literal used in a test (inputs, expected values, tolerances) must be a named constant with a comment explaining what it represents and why it has that value. No unexplained `0.1`, `37`, `2.83`, etc.
- **All tolerances documented:** Every comparison tolerance must be a named constant (e.g. `SPL_TOLERANCE_DB = 0.1`) with a comment explaining why that tolerance is physically appropriate.
- **Parameterised tests are allowed** as long as each scenario row has a clear human-readable label explaining what case it covers.
- **References must be verified:** Any citation (AES paper, Wikipedia URL, textbook) included in test or source code comments must be verified to exist before inclusion. Do not invent or assume URLs — check them. Flag unverified citations with `⚠ Unverified reference`.
- **No magic numbers in source code:** Every non-obvious numeric constant in `src/core/` must have a comment explaining its physical meaning and a source reference where applicable. Named constants are preferred over inline literals.
- **Test framework:** Use `node:test` (`import { describe, it } from 'node:test'`) with `node:assert/strict`. Run with `node --test test/*.test.mjs`.

## Driver data — human-verified flag rules

These rules apply to all `boxbench_` fields in WDR files, and to any commentary or provenance text written into driver data files.

- **NEVER write "human verified", "human-verified", "verified by human", or any equivalent phrase** in any WDR field (`boxbench_corrections`, `boxbench_detail`, `boxbench_reviewedBy`, or any other field) unless the user has **explicitly granted permission in this conversation**.
- The only valid trigger is the user saying something like "mark as human verified", "you can mark it verified", or equivalent explicit instruction addressed to you in this session.
- If you believe the user has reviewed the data and may have forgotten to grant this permission, you **may ask once**: *"Would you like me to mark this as human-verified?"* Do not assume permission; wait for an explicit yes.
- An AI writing that it "confirmed" or "verified" data in `boxbench_corrections` does NOT count as human verification, even if the AI performed checks. `boxbench_corrections` is AI-owned and must never contain verification language implying human sign-off.
- `boxbench_reviewedBy` must remain `null` or unset until the user explicitly authorises it for a specific driver or batch.

## Driver data — batch fix SOP
- **Datasheet first, always.** Before applying any automated DQ fix to a WDR field, read the cached datasheet from `drivers/<collection>/datasheets/` and confirm the correct value is there. Never apply a batch fix on pattern alone.
- **Be suspicious of repetition.** If multiple drivers in a family produce identical values, verify each PDF independently — the match may be a regex hitting boilerplate rather than real per-driver data.
- **If the field doesn't exist in the datasheet, don't invent it.** Omit the field and add a `boxbench_corrections` note explaining why — e.g. AMT tweeters have no T/S Fs; compression drivers rarely publish Fs. A missing field is more honest than a plausible-sounding placeholder.
- **Record datasheet evidence in `boxbench_corrections`.** State what the datasheet says and which file it came from. This lets a future reviewer verify the fix without re-fetching the PDF.

## Driver data — PDF sourcing and debugging

- **Cached PDFs are the primary source.** Always try `drivers/<collection>/datasheets/<filename>` first. Filenames are derived from the `boxbench_datasheet` URL.
- **If no cached PDF, or if pypdf extracts no text:** Search for the PDF using web search with query `pdf <Brand> <Model>` — e.g. `pdf HiVi F8`. Scan the results for a direct PDF link, preferring the manufacturer's own site. If no manufacturer PDF is found, accept a major vendor (Parts Express, Mouser, Digikey). Do not use random or unknown third-party sites.
- **PDF link priority (strict):** manufacturer site PDF > Parts Express / Mouser / Digikey PDF > skip and fall back to human review. Never use an unknown site.
- **Fallback to human review.** If no extractable PDF can be found after web search, use `scripts/verify-vas-tiny.py` — it opens the cached PDF in the local viewer and prompts for the field value.
- **Add DQ post-check.** After writing any fix to a WDR, re-run `check_fields()` and confirm the flag is cleared. If the flag remains, the fix value is wrong or the rule threshold needs review.

## External claims — require evidence, label inline
- Never assert facts about external systems — tools (WinISD, LEAP, REW, etc.), websites, services, APIs, or data sources — without primary-source evidence obtained in the current conversation: a tool call, a fetched URL, a read file, or directly observed output.
- **The user must not have to verify my claims.** Any external claim that has not been verified in the current session must be flagged inline in the response with "⚠ unverified" before it reaches the user — not corrected after they catch it.
- Inferred or assumed behaviour **must** be labelled as such in code comments, docs, and conversation. Record tool-behaviour assumptions in `WINISD.md` (or the relevant tool's notes file) with an explicit "⚠ Assumption — NOT directly verified" marker and a verification procedure.
- Example violations to avoid: stating "WinISD uses 2.83 V fixed" without a source; stating "Eminence publishes machine-readable data files" without having fetched evidence of this.
- **Hard gate:** Before making any comparative or causal claim about an external system ("X works because…", "unlike Y which…", "Y publishes…", "Z supports…"), call `advisor` to review the claim. Do not state it to the user until advisor has confirmed it is grounded.
