---
paths:
  - "**/*.md"
  - "**/*.ts"
  - "**/*.vue"
  - "scripts/**/*.mjs"
---

# Speech — what agents should and should not say

Stripped, concrete language. No filler, no hype, no emphasis-mongering.

## Never say

- **"THE FINAL RULE"** — every rule is final. There is no ranking that needs a megaphone.
- **"THE ONLY Decision"** / **"THE ONLY BAR"** / **"THE ONLY criterion"** — empty hype. "only" as a substitute for content. Just say "the bar" or "the criterion".
- **"This is the ONE thing"** / **"the ONE thing I am finishing"** — just say "this".
- **"THE condition fails catastrophically"** — the caps and drama don't add information.
- Any phrase where removing the emphasis word doesn't change the meaning. If "THE" or caps or "THE ONLY" can be deleted and the sentence says the same thing, delete it.

## It's fine to say

- "The only test that fails is X" — `only` is adding precision, not hype. It tells you exactly one thing fails and nothing else. That's useful content, not filler.
- "The bar is X" — plain, direct.
- "The condition fails" — states the fact without the drama.

## The test

Before sending any sentence: remove the emphasis — caps, "THE", "THE ONLY", "ONE thing", "final", "key", "critical" — and read what's left. If the sentence still means the same thing, delete the emphasis. If removing it changes the meaning (you lose precision, not drama), keep it.

## Silence is better than filler

If a line doesn't change what the reader does next, delete it. This applies to prose in code, doc comments, commit messages, and conversation alike.

## Doc comments — lead with the fact, never a rhetorical count

Banned opener: telling the reader how many things are coming before naming any of them —
`"The two facts that..."`, `"The four ways..."`, `"A field's one write..."`. Same move as `THE
ONLY X` above with the caps sanded off: it makes the reader hold an unresolved count in their
head, then re-read to find what the N things actually are. Diagnosed 2026-09-22, John: "these
comments are total BS", "I want direct non conversational, accurate terse comments" —
`packages/design/domain/cell.ts` was full of them.

Bad → good (real fixes from that file):

- "The two facts that only mean something where a solver might have written this slot: was X,
  or Y." → "Only meaningful where a solver might write this slot: is X, or is Y."
- "A field's one write a solver never makes: entering a project fact." → "`entered(v)`: the
  one write a solver never makes — a project fact."
- "The two ways a nullable field ... gets written: `entered`/`clear` are the project's own
  facts." → "`entered`/`clear` — the project's own facts."

Rule: open with the member name, the fact, or the rule itself. A count is fine mid-sentence if
it is load-bearing information ("all 4 fields", "one of 3 states") — never as a scene-setting
device standing in front of the actual content. Test: read only the first clause — does it name
a real fact/member, or does it just promise how many are coming? If it only promises a count,
cut the promise and start with the first fact.

## Doc comments describe behaviour, not implementation

An interface's comment states the contract it promises — what a caller can rely on. It never
explains how some particular class that happens to implement it is built inside. That
explanation belongs on the class, where "implementation" is the honest word for it.

Real fix, 2026-09-22: `FieldWrites<T>` (a plain write-method contract) carried "a pure lens over
whatever storage implements these, never a store of its own (T11: `get()` is one record read, no
private shadow state...)" — that sentence is about how `DualWriteFieldImpl` is built, not about
what `FieldWrites<T>` promises. Moved to `DualWriteFieldImpl`'s own comment, where `writes`/
`readCell` are real fields the sentence can name. John: "its not up to the comment to explaain
the impl ... just the behaviour."

Test: does the comment name fields/methods of the type it's attached to, or does it reach into a
*different* type's internals to justify itself? If the latter, move it to that other type.

## Vocabulary — domain words, used precisely

- `wdr` / `.wdr`: the WinISD driver file format. Nothing else.
- `owdr` / `.owdr`: the OpenISD driver file format.
- "OpenISD driver": the domain object (`OpenISDDriver`); "WinISD driver": a driver as WinISD models it.
- Say the domain thing you mean — the file format, the domain object, the import — never a
  nickname for a spec, a test or a feature ("the driver-file import spec", not "the wdr spec").
  (John, 2026-09-21.)

## Tables — real markdown, columns aligned

- Every table is `| col | col |` markdown with a `---` header-separator row. Never ASCII
  box-drawing (`│`/`├`/`┼`) — it only renders in one specific terminal/viewer and garbles on
  paste elsewhere.
- Pad each column's cells to the same width so the `|` characters line up vertically in the
  raw source, not just in the rendered output. (John, 2026-09-22.)
