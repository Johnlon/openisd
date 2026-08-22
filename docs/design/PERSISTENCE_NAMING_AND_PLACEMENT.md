# Persistence vocabulary: STORAGE, REPO, STATE — the one naming and placement rule

> RULING UPDATE (orchestrator, 2026-08-22, under delegated authority — pending John's review):
> the word **"store" is eliminated from the codebase entirely**. The port is **STORAGE**
> (`KeyValueStorage`, `FileStorage` — the web platform's own word: `localStorage` IS a
> `Storage`), the app state is **`appState`**, and nothing is called a store. Rationale:
> keeping `Store` beside `Storage` leaves two near-identical words meaning different things —
> the same class of misdirection this rule exists to remove, and John called that a fudge by
> implication ("dont fudge it"). His open question ("do we need a different term for our
> 'store' like 'browser_storage'?") pointed here; this adopts it. Every STORE reference below
> reads as STORAGE; the rename map gains: `KeyValueStore`→`KeyValueStorage`,
> `FileStore`→`FileStorage`, `createFileStore`→`createFileStorage`,
> `createLocalStorageStore`→`createLocalStorage`… (final spellings at implementation).

Ruled 2026-08-22. Three concepts, three words, three homes. A module is exactly one of them.
No module may be two. If a name and a role disagree, the NAME changes — never the definition.

## The three concepts

### STORE — a dumb port onto somewhere bytes live

A store knows a medium. It does not know what a driver is, what a preference is, or what any
value means. It moves opaque bytes or strings in and out and nothing else. Swapping one store
for another (localStorage → memory) changes where data lives and nothing about behaviour, which
is what makes every repo testable without a browser.

- MUST NOT: parse a domain shape, name a domain type, validate a record, hold app state.
- MUST: be replaceable by an in-memory twin with no behavioural difference.
- Named `<Medium>Store` / `create<Medium>Store`.
- Two exist and only two kinds are foreseen: keyed (`KeyValueStore`) and interactive
  (`FileStore` — the user picks the destination; still no format knowledge).

### REPO — domain-shaped access to exactly ONE collection of records

A repo answers questions about one collection and hands back records. It takes a store and
turns bytes into records and back. One repo per collection: the collection IS its single
responsibility.

- MUST NOT: know a dialog is open, decide what happens next, read app state, hold reactive
  state, or serve two collections.
- MUST: take its storage by injection and deal in DOMAIN OBJECTS and owner-serialised text
  (SERIALIZATION_DOCTRINE.md, ruled 2026-08-22 — the owner of the state serialises and
  persists it; the earlier records-currency rule is superseded, and construction routes
  through the licensed factories, never the repo naming the private shape).
- Named `<Collection>Repo` / `create<Collection>Repo`, file `<collection>Repo.ts`.

### STATE — the app's live, reactive, in-memory truth

Neither of the above. It is what the UI renders and what workflows mutate. It is not persisted
by itself; a repo or a store persists it.

- MUST NOT be called a "store", ever, whatever Vue convention says. That word is taken by the
  port, and the collision is the single biggest source of misdirection in this tree.
- Named `<scope>State` / file `<scope>State.ts`.

## Banned words

- **"library"** as a module or type name for persistence. It reads as a collection but names
  neither the medium nor the collection role. (`prLibrary.ts` exporting `PrRepo` is exactly the
  confusion this bans.) `driverLibrary.ts` is NOT persistence — it is reactive browsing state
  and is renamed under the STATE rule.
- **"bucket"** for the underlying medium. Say "the store", or name the medium
  (`localStorage`). A fourth word for the thing already called a store is drift.
- **"db"** as a directory name meaning "persistence" — it implies a database that does not
  exist. `ARCHITECTURE.md:532` already argues this ("Why a repository, not a db"); the
  directory contradicts the paragraph.

## Placement

```
packages/ui/src/persistence/
  stores/                  ports only — no domain vocabulary anywhere in this directory
    keyValueStore.ts       KeyValueStore + createLocalStorageStore + createMemoryStore
    fileStore.ts           FileStore + createFileStore
  repos/                   one file per collection, each taking a store
    driverRepo.ts
    myDriverRepo.ts
    prRepo.ts
    prefsRepo.ts
packages/ui/src/logic/
  appState.ts              the reactive app state
  presentationState.ts     view state (already correct)
  driverBrowsingState.ts   reactive browsing surface (from driverLibrary.ts)
```

The `stores/` ↔ `repos/` split is the enforceable form of the rule: a file under `stores/`
that names a domain type is a violation a gate can SEE, and so is a file under `repos/` that
touches `window`/`localStorage` directly instead of taking a store.

## The rename map

| today | becomes | why |
|---|---|---|
| `db/kv.ts` | `persistence/stores/keyValueStore.ts` | name the concept, not an abbreviation |
| `logic/fileStore.ts` | `persistence/stores/fileStore.ts` | it IS a store; it was never logic |
| `db/driverRepo.ts` | `persistence/repos/driverRepo.ts` | move only |
| `db/myDrivers.ts` | `persistence/repos/myDriverRepo.ts` | file now matches `MyDriverRepo` |
| `db/prLibrary.ts` → `PrRepo` | `persistence/repos/prRepo.ts` | file matched neither role nor type |
| `db/prefs.ts` → `PrefsStore` | `persistence/repos/prefsRepo.ts` → `PrefsRepo` | it takes a store and returns domain values: it is a REPO |
| `logic/store.ts` | `logic/appState.ts` | frees the word "store" for the port |
| `logic/driverLibrary.ts` | `logic/driverBrowsingState.ts` | reactive (`ref()`), so STATE, not persistence |

Symbols follow the files: `createPrefsStore` → `createPrefsRepo`, `PrefsStore` → `PrefsRepo`.
Comments and docstrings using the old vocabulary are corrected in the same pass — a rename that
leaves the prose behind rebuilds the confusion it was meant to remove.

## Every module of these three kinds carries a one-line gloss

Because "store"/"storage"/"state" are near-neighbours in English and one of them collides with
Vue's own vocabulary, each module states which concept it is, in its first docstring line, in
this exact shape:

```ts
/** STORAGE (port): where bytes live. Knows keys and strings, never what a driver is. */
/** REPO: domain access to the My Drivers collection. Takes a storage, returns records. */
/** STATE: the app's live reactive truth — Vue's sense of "store". Not persistence. */
```

This is not restating the code: without it a reader meeting `FileStorage` and `appState` in
adjacent imports cannot tell which layer either belongs to, and that is exactly the
disambiguation a comment is FOR (`behavioral_instructions.md` §"No Useless Text" permits text
that "disambiguates something genuinely ambiguous"). Any consumer that holds one of these as a
local name (`const storage = …`) carries the same one-line gloss at the binding.

## Enforcement

An AST gate (`no-persistence-vocabulary-drift`), so this cannot rot back:
1. No file under `stores/` imports a domain type or names a domain concept.
2. No file under `repos/` touches `window`, `localStorage`, or a browser API directly — it
   takes a store.
3. No exported symbol matching `/Store$/` lives under `repos/`; none matching `/Repo$/` lives
   under `stores/`.
4. No exported symbol outside `persistence/` is named `*Store` except the ports themselves.
5. No module or exported type name contains `Library` or `Bucket`.
Shape-based checks over the AST, never prose greps — a docstring explaining the rule must not
fail the rule (`behavioral_instructions.md` §"BAN THE CODE, NEVER THE VOCABULARY").

## Why not just rename `PrefsStore` and stop

Because the collision is the actual defect. `ARCHITECTURE.md:534` says repos "never touch the
store" meaning app state, one paragraph after describing repos that take a store meaning the
port. Two opposite meanings of one word in adjacent sentences is misdirection a reader cannot
resolve from the text. Renaming one symbol leaves that intact.
