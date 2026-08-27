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

## NO GLOBAL WITHOUT A RECORDED "OK"

No module-scoped state. Not a `let`, not a `var`, not a mutable `const` container (`Map`, `Set`,
`WeakMap`, array, object), not a registry, not a singleton, not a cache.

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
