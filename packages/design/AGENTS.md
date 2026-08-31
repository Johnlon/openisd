## ⛔ NOTHING CHANGES WITHOUT JOHN'S EXPLICIT APPROVAL (John Lonergan, 2026-08-26)

**His words:** *"in te design repo from now on - there are no exceptions - the human must approve
every change or the ai automatically reverts and stops"*.

**NO EXCEPTIONS.** This overrides every other instruction telling the agent to act, finish the
task, or fix a defect on sight. Here the agent PROPOSES and STOPS.

**Approval means John said yes to THIS change.** It is not implied by:
- the change being obviously correct, small, or a one-liner;
- a rule elsewhere saying to fix defects immediately;
- John naming a problem — naming a problem is not approving a fix;
- John approving a related change, or a similar one earlier;
- tests passing, or the type-checker demanding it.

**Unapproved change: revert it and stop.** Not "note it and carry on".

**A deletion John orders is approved; whatever fills the hole is not.** If removing something
leaves a gap that needs a design decision, say so and stop.

**Adding an API is a change** — a function, method, type, parameter or export John did not ask
for, however necessary it looks.

**Never write a justification comment for an unapproved choice.** It turns a guess into apparent
doctrine and hides that nobody agreed to it.

---

## ⛔ STANDING ORDER — DUPLICATE, MIGRATE, DELETE (John Lonergan, 2026-08-29)

**His words:** *"STANDING ODER FOR NOW - we are duplicating then we will migrate then we will
delete"*.

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

**His words:** *"standing order - dont invent"*, after *"what is stated: ? never discussed
'stated' - you are going off pise again"*.

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

No module-scoped state. Not a `let`, not a `var`, not a mutable `const` container (`Map`, `Set`,
`WeakMap`, array, object), not a registry, not a singleton, not a cache.

**ENUMERATIONS ARE PERMITTED. GLOBAL COLLECTIONS AND VARIABLES ARE NOT** (John 2026-08-29:
*"enumeration are permitted / global collections and vars are not permitted"*).

An ENUMERATION names a closed set of constants and is reached BY NAME —
`SourceRole.ManufacturerDatasheet`, `VoiceCoilWiring.Series`. Its members are part of the
vocabulary, not data the program looks things up in, and there is nothing to mutate or to hold
a value that differs between reads.

A COLLECTION is indexed by a runtime key — `TABLE[name]`, `SET.has(x)`, `MAP.get(k)`. That is
shared lookup state whatever it is declared as, and `as const` does not change it: the same
object serves every caller, and what it answers is a fact about the module rather than about
the arguments. Write a `switch`, or pass the table in.

**The test is HOW IT IS REACHED, not how it is declared.** `const T = {...} as const` indexed
as `T[key]` is a collection. A `switch` over the same cases is not.

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
