# Domain API — deny by default, public only by explicit approval

Human directive 2026-08-22: *"make everything explicitly private unless there is a legitimate
right of access as a result of approval from me of specific symbols. the api is way too loose."*

THE RULE: a member of a domain class is `#`-private unless it appears in the APPROVED list
below with John's sign-off. Adding a public member is a decision, not a default — a new symbol
starts private and is promoted only by an entry here.

## Measured starting point (2026-08-22, class members only)

| class | public | `#`-private |
|---|---|---|
| `OpenISDDriver` | **26** | 12 |
| `OpenISDProject` | **18** | **1** |

`OpenISDProject` has ONE private member. Two of its "private" methods — `_driverJsonRecord`,
`_projectJsonRecord` — are private by naming convention only; the language makes them fully
public and any caller can invoke them.

## `OpenISDDriver` — proposed disposition of all 26

**RULED PRIVATE ALREADY** (John, 2026-08-22 — "make those to/from functions private #"):
`toJsonRecord`, `static fromJsonRecord`.

**RULED PRIVATE — ALL SERIALISATION** (John, 2026-08-22, widening the above: *"the dialog isnt
permitted to call toOwdrText either we are making it all #private"*, *"the dialog has no right
to serialise anything or see serialised data"*): `toWdrText`, `toOwdrText`, `static
fromWdrText`, `static fromOwdrText`, `static fromFileText` — every method that produces or
consumes serialised text. Same treatment on the project class.

**THE PUBLIC FILE SEAM THAT REPLACES THEM** — domain operations plus a model-owned seam:
`save(domainObject, format, sinkCapability)` and `load(sourceCapability) -> domain object`.
Serialised text exists ONLY inside the model's own file code, between the private serialiser
and the injected sink/source. No non-owner ever holds or sees text in any format.

**Why the injected capability matters beyond privacy:** it also keeps `packages/model`
PLATFORM-FREE. The model never imports `localStorage`, `window`, or a file API — it calls a
capability handed to it. That is what lets the same code bundle into py-mini-racer for the V8
bridge, where none of those globals exist. Owner-owns-persistence and platform-free are not in
tension once the capability is injected rather than imported.

**✅ APPROVED PUBLIC (John, 2026-08-22: "this looks correct") — reading a value.** None of these
exposes the record shape: `cell`, `metaCell`, `description`, `sku`, `dqMarks`, `errors`,
`consistencyIssues`, `ebp`.

**PROPOSED PUBLIC — editing** (the domain API the editor works against):
`enter`, `clear`, `enterMeta`, `clearMeta`, `get/set autoCalculate`.

**PROPOSED PUBLIC — construction**: `static empty`.

**PROPOSED PRIVATE — needs your ruling:**
- `toWinISDDriver` / `static fromWinISDDriver` — these hand out the WinISD projection OBJECT.
  `toWdrText`/`fromWdrText` are the public route to the same capability, so the object form
  looks like an internal step exposed. Callers outside the model would have to be checked.
- `get section` — returns a spec SECTION, which is part of the record's own shape. If the UI
  needs section-level reads, it should ask for values, not for the section.
- `toDriver` — hands out the engine-facing driver structure. Legitimate if the engine boundary
  needs it; private if the model should drive the engine itself.

## `OpenISDProject` — proposed disposition of all 18

**PROPOSED PRIVATE — the two convention-only fakes**: `_driverJsonRecord`, `_projectJsonRecord`.
Underscore is not privacy; these must become `#`. This is the same class of defect as the
`DriverJSON` alias: a private-looking name the language does not enforce.

**RULED PRIVATE by the same directive as the driver**: `static fromJsonRecord`.

**PROPOSED PUBLIC — the file API**: `static fromWprText`, `static fromWinISDProject`.

**PROPOSED PUBLIC — reading**: `get box`, `get target`, `get environment`, `get signal`,
`get listening`, `get simOptions`, `get sweep`, `get meta`, `get filters`.

**PROPOSED PUBLIC — writing**: `setDriver`, `set filters`.

**PROPOSED PUBLIC — construction**: `static empty`, `copy`.

**NEEDS YOUR RULING:** the nine `get` accessors hand out sub-structures (`box`, `target`,
`environment`…). Each is a door into part of the project's state. If callers mutate what they
receive, they are editing project internals without going through the project. Whether these
stay public depends on whether they return values the caller may hold — worth deciding as one
group rather than nine times.

## Enforcement

The AST gate checks every domain-class member against this list: a public member with no entry
here FAILS. The list is human-edit-only, like `ALLOWED_GLOBALS` — an agent may propose an
addition in a ledger question, never add one.

## Orchestrator ruling 2026-08-22, AMENDED same day (John away, authority delegated — pending his review)

FIRST FORM, WITHDRAWN: `draftDriverForEditor(): OpenISDDriver`. The always-enforced
"ManagedOpenISDProject never hands an OpenISDDriver out" gate rejects it — and the gate is
RIGHT: a returned live object is a channel the type system hands to ANY caller, while a text
hand-off is only useful to a file licensed to construct. Found by sonnet1 RUNNING the gate
before building.

RULED INSTEAD: `ManagedOpenISDProject.committedDriverText(): string` — the committed driver's
own serialisation (or the empty driver's when none is chosen). Callable by any file licensed to
construct a driver; today's one consumer is DriverEditorModal, which builds its own draft via
`fromOwdrText` (itself probed by the draft exemption) and commits back through the existing
adoption channels. NOT opacity-as-licence: the ban is on NON-owners holding state, and the
modal is a licensed holder — this is a sanctioned construction channel, the exact one the gates
were built around. Becomes part of the capability seam when serialisation goes `#`-private.
The selector-intermediary design and `editorSeedDriverText()`'s name die with this.
