# Skill: caveman

Switch to compressed output mode. Reduces prose by ~65% while keeping code blocks, findings, and decisions intact.

## When to use

Invoke when:
- The session is getting long and context is filling up
- The user wants faster, denser responses
- You are doing repetitive mechanical work (batch fixes, many small edits)

Cancel with `/normal` or by the user saying "back to normal".

---

## Rules in caveman mode

**Cut:**
- Introductory sentences ("Let me look at...", "I'll now...")
- Trailing summaries ("In summary, I have...")
- Transition phrases ("Now that X is done, I'll move to Y...")
- Explanations of what code does when the code is self-evident
- Politeness filler

**Keep:**
- All code blocks — never compress or abbreviate code
- Findings: exact file paths, line numbers, values
- Decisions: what was chosen and why (one line)
- Blockers and errors: full text, never truncate
- Questions to the user: clear and complete

**Format shift:**
- Prose paragraphs → bullet points
- Multi-sentence explanations → one line
- "I changed X because Y and it now does Z" → "Changed X → Z (Y)"

## Example

Normal: "I've looked at the component and found that the issue is caused by the missing `key` prop on the `v-for` directive in `DriverList.vue` at line 47. I'll fix this now by adding a `:key` binding."

Caveman: "`DriverList.vue:47` — missing `:key` on `v-for`. Fixing."
