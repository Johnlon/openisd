## ⛔ NOTHING CHANGES WITHOUT JOHN'S EXPLICIT APPROVAL (John Lonergan, 2026-08-26)

**His words:** _"in te design repo from now on - there are no exceptions - the human must approve
every change or the ai automatically STOPS and asks for permission"_.

**NO EXCEPTIONS.** This overrides every other instruction telling the agent to act, finish the
task, or fix a defect on sight. Here the agent PROPOSES and STOPS.

**Approval means John said yes to THIS change.** It is not implied by:

- the change being obviously correct, small, or a one-liner;
- a rule elsewhere saying to fix defects immediately;
- John naming a problem — naming a problem is not approving a fix;
- John approving a related change, or a similar one earlier;
- tests passing, or the type-checker demanding it.

**Unapproved change: STOP and ask for permission.** Not "note it and carry on" — and NOT a revert
on the agent's own initiative either. The work stays exactly where it is, untouched, until John
rules on it.

**A deletion John orders is approved; whatever fills the hole is not.** If removing something
leaves a gap that needs a design decision, say so and stop.

**Adding an API is a change** — a function, method, type, parameter or export John did not ask
for, however necessary it looks.

**Never write a justification comment for an unapproved choice.** It turns a guess into apparent
doctrine and hides that nobody agreed to it.

---

## ⛔ STANDING ORDER — DUPLICATE, MIGRATE, DELETE (John Lonergan, 2026-08-29)

**His words:** _"STANDING ODER FOR NOW - we are duplicating then we will migrate then we will
delete"_.

The `packages/model` → `packages/design` migration runs in three phases, in this order:

1. **DUPLICATE** — copy the capability into `packages/design`. The original stays where it is
   and keeps working. Its consumers are not touched.
2. **MIGRATE** — move consumers onto the design copy, one at a time.
3. **DELETE** — remove the original once nothing imports it.

**A COPY IS THE INTENDED STATE DURING PHASE 1, NOT A DEFECT.** While this order stands, the
global rule in `~/.claude/behavioral_instructions.md` §"ONE model version exists" does NOT
authorise deleting a design-side copy, a model-side original, or the duplication between them.
That rule bans a second SHAPE of one concept living behind version-supporting code — branching
on which shape it got, coercing one into the other, falling back between them. It does not ban
an identical copy that exists to be migrated onto and then removed.

**The test for what is still banned, unchanged:** does anything read BOTH the model copy and
the design copy and choose? Does anything translate between them? Does either accept the
other's shape? Any "yes" is the real violation and is deleted on sight. Two identical
declarations, each with its own consumers, is phase 1 working.

**Duplicates carry no marker.** No `// duplicated from`, no `@deprecated`, no phase comment —
`~/.claude/behavioral_instructions.md` §"No Useless Text" and §"Never comment on what the code
used to be" both still apply in full. What is duplicated is tracked in the migration's own
records, never in the artifact.

**Phase 3 is not optional and not indefinite.** A capability left duplicated after its
consumers have moved is the failure this order exists to pass THROUGH, not to stop at.

---

## ⛔ STANDING ORDER — DON'T INVENT (John Lonergan, 2026-08-27)

**His words:** _"standing order - dont invent"_, after _"what is stated: ? never discussed
'stated' - you are going off pise again"_.

**Build what John specified. Nothing adjacent to it.** When a task names a shape — "add `.spec.woofer`
and `.spec.tweeter`" — that shape is the whole of the work. An extra member, an extra convenience,
a "while I'm here" nicety is an INVENTION, and it lands in the design as though it had been agreed.

**Inventing includes CHANGING BEHAVIOUR NOT MENTIONED.** Rewriting a method that threw so it now
succeeds, widening what an input accepts, adding a fallback — all of it, even inside a file the
agent was told to edit.

**The tell:** the agent cannot quote the sentence of John's that asked for it.

**When the specified shape leaves a genuine gap, say so and stop.** Do not fill it and explain
afterwards — see the approval rule above, which this serves.

**Precedent (the rule's origin):** told to add `.spec.woofer` and `.spec.tweeter`, the agent also
added `.spec.stated`, a third member nobody had discussed, and in the same edit silently changed
spec-field `clear()` from a refusal into a key deletion.

---

## NO GLOBAL WITHOUT A RECORDED "OK"

No module-scoped MUTABLE state. Not a `let`, not a `var`, not a mutable `const` container
(`Map`, `Set`, `WeakMap`, array, bare object), not a registry, not a singleton, not a cache.

**MUTABILITY IS THE WHOLE TEST** (John 2026-09-01: _"relax it to key on mutability rather than
on indexing — global mutable state is the only problem with globals"_).

An IMMUTABLE module-scoped constant is permitted, and it may be indexed by a runtime key. A
frozen table causes none of the three harms this rule exists to prevent: there is no install
order to get wrong, no second-instance problem, and "what is the current value" has one answer
forever. What makes a global dangerous is that it VARIES.

**Permitted:** `Object.freeze({...})` — immutable at runtime, and the form to use for a lookup
table; `{...} as const` — readonly to the compiler, which is real enforcement in a package that
bans casts; primitives; arrow functions.

**Still banned:** a bare object or array literal (its members are assignable, so `const` buys
nothing); `new Map()`/`new Set()`/`new` anything; and — whatever the initializer looks like —
any module-scoped binding that something WRITES to, including through a cast.

**Recorded means written below**, naming the variable and the date. If it is not written here it
is not approved, and the agent deletes it rather than asking again.

Enforced by `test/architecture-no-globals.test.ts`, whose `APPROVED` list must match this one.

**When a global looks necessary, the design is wrong.** Say so and stop.

### Approved globals

**`NO_LOSSES`, `NO_VENT`, `NO_CHAMBER`** — 2026-08-27.

Three shared const objects in `domain/project.ts`, the starting values a brand-new box is built
from. Every use spreads them (`{ ...NO_CHAMBER }`), so the object reaching a project's record is
always fresh and the shared constant is never embedded.

Nothing else is approved.

---

## 🔍 A CAST IS A CONVERSATION, NOT A CRIME (John Lonergan, 2026-08-31)

**His words:** _"when you find the need to add a cast then you MUST discuss with the human — it
isn't necessarily evil so discuss with the human ... aim is to speak to human not prevent 100% as
sometimes it's needed"_.

**A cast is not banned. Adding one WITHOUT ASKING is.**

When the agent reaches for `as`, it stops and puts three things to John:

1. **what the cast asserts** — the exact claim being made about the value;
2. **why the compiler cannot prove it** — the specific reason narrowing, a type guard, a
   `satisfies` list or an `Exclude<>` completeness proof does not reach;
3. **what the honest alternative costs** — because "it is more work" is a reason to ask, never a
   reason to assert.

Then he decides. An approved cast is fine and stays. An unapproved one is the agent making a
type-safety decision that was never its to make.

**The failure mode this catches is not "wrote a cast" — it is "wrote a cast INSTEAD of asking".**
Every cast this project has had to unpick arrived that way.

**Erasure counts, whatever it is spelled.** `as unknown as X`, `as any`, `as Record<string,
unknown>`, `as {[k: string]: unknown}` — a widened or keyless type still carries the value, and
swapping one spelling for another is not a fix. `Record<string, unknown>` in particular declares
no members: it tells a reader and the compiler nothing, so the cast buys no information and costs
the check it appears to perform.

**Not casts, and never were:** `as const` makes a literal readonly; `satisfies` CHECKS. Neither
tells the compiler that one type is another.

Enforced by `test/architecture-no-casts.test.ts`, whose red result means "take this list to John",
not "make it green".

---

## ⛔ INTERNAL JSON RECORD TYPES — NEVER RE-EXPORTED FROM `domain/index.ts` (John Lonergan, 2026-09-05)

**His words:** _"I am permitting reuse within the domain folder not exports form it"_.

`OpenISDDeviceJson`, `OpenISDBoxJson`, `OpenISDProjectJson` and every JSON-shape type
declared alongside them (`ChamberJson`, `VentJson`, `OpenISDEnvironmentJson`,
`SpecEntryJson`, `Reading`, `DqMark` and the rest) may carry `export` so files inside
`packages/design/domain/` can import them from each other — that is the whole point of
consolidating them in one schema file rather than declaring them once per class file.

**`packages/design/domain/index.ts` — the package's public surface — must never re-export
any of them.** Not as a type, not as a value, not through a wrapper type that carries the
same shape under a different name. A consumer outside `domain/` (the UI, a test importing
`@openisd/design`, another package) gets `OpenISDDriver`, `OpenISDProject` and the other
class/interface surface those files already publish — never the raw record shape
underneath.

**The test is what `domain/index.ts` exports, not where a type is declared.** Exporting a
JSON record type from that one file is the same violation whether it is spelled as the
type itself, `Pick<>`/`Omit<>` of it, or a structural alias that reproduces its shape.

Enforced by whichever architecture test checks `domain/index.ts`'s export list — add one
if none currently does.
