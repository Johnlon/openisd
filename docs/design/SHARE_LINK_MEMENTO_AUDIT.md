# Share-link audit against the memento doctrine

> ## ⛔ READ THIS FIRST — THE MEMO IS NOT A LOOPHOLE (human, 2026-08-22, emphatic)
>
> **His words:** *"I dont want the internal state leaking out of the component at all - there
> are no exceptions and the grant that the sharing facility is given a memo from various
> components may in no way be interpreted by the AI as a weakening of that rule. There is no
> situation where I want even an opaque version of that state being passed around."*
>
> **OPACITY IS NOT A LICENCE.** Making state into a string does not make it stop being that
> component's state. An agent that reasons *"it is only an opaque blob now, so encapsulation is
> satisfied"* has broken the rule, not satisfied it — and has done so while producing a diff
> that looks compliant. That reasoning is banned outright.
>
> **This has already happened once in this codebase, which is why the rule is written this
> emphatically.** A6 changed `SerializedState.driver` from the private record type to `string`
> and declared the boundary closed. One consumer then did
> `JSON.parse(persistedDriver.value) as _OpenISDDriverJson` — the same bytes, the same coupling,
> now invisible to every gate because the type no longer named it. The string bought nothing.
>
> **What a memo is:** a token that ONE owner writes and THAT SAME owner reads back, to restore
> itself. Nothing else.
>
> **What a memo is NOT, in any circumstance:**
> - not a way for a component to hold another component's state "safely"
> - not a way to pass state through an intermediate that "does not look inside"
> - not a reason to widen, alias, erase (`unknown`/`any`/`string`), clone, or stringify a
>   private shape so it can cross a boundary
> - not something any code may parse, inspect, log, transform, diff, validate, or branch on
>   unless it is the owner
>
> **The only sanctioned path is owner → persistence sink → same owner.** The sink concatenates
> and splits; it never interprets. A memo that passes through a component which reads it is not
> a memo — it is leaked state with extra steps.
>
> If a design seems to require a non-owner to understand a memo, the design is wrong. Stop and
> raise it; do not solve it by making the state opaque and calling it done.

Audited 2026-08-22 at John's instruction (QO83 item 4, his words: "it should ask the the varios
components for an opaque 'memo' that can be used to reestablsh state - i suspect this feature is
total vibe codeed shit"). Verdict: the suspicion is correct for 8 of 9 payload fields. One field
is already a proper memento — and it only became one hours ago, under A6.

## What the doctrine requires

Each owner produces an opaque memo and consumes its own memo back. The link code concatenates
and splits; it never knows what is inside a memo, and a field added inside one changes no code
outside its owner.

## What `persist.ts::serialize` does today (`:32-56`)

```ts
export function serialize(
  box: BoxType, project: ProjectMeta, view: PresentationState, driver: string | undefined, p: UiParams,
): SerializedState
```

| payload field | source | memento? |
|---|---|---|
| `driver` | the model's own serialisation, an opaque string | **YES** — the only one |
| `box` | passed through whole | no — a domain type crosses as a structure |
| `P` | `UiParams`, passed whole | no |
| `project` | `ProjectMeta`, passed whole | no |
| `lossMode` | `view.lossMode` | no — reaches INTO `PresentationState` |
| `graphs` | `view.graphs` | no — reaches in |
| `ui` | `view.ui` | no — reaches in |
| `cursor` | assembled from `view.cursorF`, `view.pinnedF`, `view.cursorLocked`, `view.dragRange` | no — reaches in for FOUR separate fields and rebuilds a shape |
| `v: 2` | literal | dead (below) |

`serialize` knows the internal field names of `PresentationState` and rebuilds its cursor shape
by hand. That is the inverse of the doctrine: adding a field to the presentation state requires
editing `persist.ts`, `SerializedState`, and every reader — which is exactly the coupling a memo
removes.

`driver` is the counter-example that shows the pattern works: it is a string the model produced
and only the model can read, so nothing in this file knows what a driver contains.

## Two defects found while auditing

1. **`v: 2` is dead.** Its own comment states it "was written for years and never read once".
   The payload already carries `schema` (`CURRENT_SCHEMA`), which is the field the upgrade chain
   reads. `v` is kept "only because the type still declares it" — the type is the thing to fix.
   Under the one-model rule a field no code reads is deleted, not preserved.
2. **`stateToUrl` reads globals** (`:70`): `location.origin + location.pathname`. The same
   impurity A6 removed from the FileIO share-link encoder by taking a `baseUrl` parameter. This
   one was left behind because it lives on the whole-app-state path, not the domain path.

## The shape this should take

`serialize` receives one memo per owner and concatenates:

- the model produces the driver memo (exists today: `persistedDriverText()`)
- the project/box owner produces its own
- `PresentationState` produces its own — it is the owner of `lossMode`/`graphs`/`ui`/cursor, and
  the only code that should know those names
- the link/save code holds a map of `{owner: memo}` plus the schema version, and nothing else

Loading is the mirror: each owner is handed its memo back and restores itself. The upgrade chain
then applies per memo, by that owner, rather than one global step that must understand every
field in the payload at once.

## Scope note

This is a real refactor of the persistence payload shape, and it changes the on-disk/on-link
format — so it needs the same versioned-upgrade treatment the driver slot just received (V1→V2,
`schemaUpgrade.ts`). It is NOT a tidy-up to fold into another task.
