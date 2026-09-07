// ── PERSISTENCE ────────────────────────────────────────────────────────────────────────────
//
//     app / UI
//        │   domain objects only — `OpenISDProject`
//     ProjectRepo     ── peer of the DOMAIN OBJECT, lives HERE
//        │   `OpenISDProjectJson`, which never appears in any signature below
//     RecordStore<R>  ── peer of the RECORD, injected, implemented elsewhere
//        │
//     IndexedDB (packages/design/browser) / a file / a server
//
// The repo is the only code that converts between the two vocabularies, so it is the only code
// that needs both. It lives in THIS module because converting requires the record type and the
// module-private `projectRecords` registry, neither of which leaves this file.
//
// The store does NOT live here, and does not need to: it is injected as a GENERIC factory
// (`projectRepo()` takes the factory), so the implementation is parametric in the record type and can neither
// name nor inspect it. That is what keeps browser code out of a package that otherwise depends
// on nothing, while `OpenISDProjectJson` stays unexported and unnameable everywhere.

/**
 * What a stored project is called, for a picker.
 *
 * PUBLIC on purpose, unlike the record: it is the label a user reads, so hiding it would only
 * force the store to invent a shape it cannot see. Carried ALONGSIDE the record rather than read
 * out of it, because the store is not allowed to look inside.
 */
/**
 * Somewhere to keep records, keyed by a string the caller supplies.
 *
 * PARAMETRIC IN `R` AND DELIBERATELY IGNORANT OF IT. An implementation stores and returns values
 * of `R` without ever inspecting them, so it cannot depend on what `R` turns out to be — which
 * is exactly what lets the record type stay private to this module while the implementation
 * lives in another package entirely.
 *
 * Ignorance costs nothing in practice: IndexedDB declares its indexes with runtime keyPath
 * strings (`'meta.name'`), so a store can index a value it has no compile-time knowledge of. The
 * bytes on disk are a real, self-describing JSON document; only the TYPE is opaque.
 *
 * ASSUMES the record is kept as a STRUCTURED VALUE, not a serialised string — a string cannot be
 * indexed, and every listing would then have to deserialise every entry.
 */
export interface RecordStore<R> {
    /**
     * Keep `record` under `id`, replacing whatever was there, and stamp it as modified now.
     *
     * TAKES `meta` SEPARATELY because it may not read the record. Stamping is the STORE's job, not
     * the caller's: "when this was last written" is a fact about the act of writing, and the store
     * is the only participant present at the moment it happens.
     *
     * WHY IT EXISTS: `ProjectRepo.save()` needs somewhere to put what it extracted, and must not
     * care whether that is IndexedDB, a file or a server.
     */
    put(id: string, record: R): void;

    /**
     * The record under `id`, or null when there is none.
     *
     * Null means ABSENT, never "unreadable" — a stored value that cannot be understood is a fault
     * to report, and collapsing the two is how a corrupt entry becomes a silently missing project.
     *
     * WHY IT EXISTS: `ProjectRepo.load()` needs the raw record before it can rebuild a project.
     */
    get(id: string): R | null;

    /**
     * Every entry's key, label and modification time — enough to draw a picker, nothing more.
     *
     * DEPENDS ON an index over the stored records. Reading whole records and discarding them would
     * work and is wrong: it makes showing a picker cost the size of every stored project rather
     * than the number of them.
     *
     * WHY IT EXISTS: it is the only way `ProjectRepo.list()` can be cheap.
     */
    list(): { id: string; label: string; modified: string }[];

    /**
     * Delete the record under `id`. Deleting an absent id is NOT an error — the postcondition
     * ("nothing is stored under `id`") already holds, which is what makes deletion safe to retry
     * after a failure with no caller checking first.
     *
     * WHY IT EXISTS: `ProjectRepo.remove()` needs it.
     */
    remove(id: string): void;
}

/**
 * A store implementation, before it knows what it will hold.
 *
 * GENERIC, and that is the whole mechanism. If the registry took a `RecordStore<OpenISDProjectJson>`
 * directly, an outsider could still satisfy that parameter by inference even without being able to
 * NAME the type — the standing hole with unexported types. A factory that must work for ANY `R`
 * cannot depend on which one it gets, so parametricity enforces the boundary instead of a naming
 * convention, and no cast is needed anywhere.
 */
export type RecordStoreFactory = <R>(labelPath: string) => RecordStore<R>;


/**
 * The app's delete dialog, as the repo sees it: shown the entry that is really about to be
 * destroyed, answering whether to proceed.
 *
 * Async because a dialog is — the repo waits for a person. `false` is a full stop, not a retry:
 * the entry is left exactly as it was.
 */
export type DeleteChallenge = (entry: ProjectListing) => Promise<boolean>;

/**
 * How a delete ended. Three outcomes rather than a boolean, because "nothing was deleted" has two
 * very different causes and a caller reporting to the user must tell them apart: the user
 * declined, versus the entry was not there at all (already deleted, or a stale row).
 */
export type DeleteOutcome = 'deleted' | 'declined' | 'absent';

/**
 * One row of `ProjectRepo.list()` — plain data for a picker.
 *
 * Deliberately NOT a snapshot of the project: a listing exists so the user can CHOOSE, so it
 * carries only what a chooser needs. Anything more would be a second route to project state that
 * bypasses `load()`.
 */
export interface ProjectListing {
    /** The STORE KEY — pass it back to `load()` or `remove()`.
     *
     *  It IS the project's uuid: `save()` keys on `OpenISDProject.uuid()`, and `load()` adopts the
     *  key back, so an entry and the project opened from it share one identity. That is what lets a
     *  workspace tell whether a row in the picker is already open, and what stops a reopened design
     *  autosaving into a second entry. */
    readonly id: string;
    /** The project's name. A LABEL, never an identity: two entries may share one. */
    readonly name: string;
    /** When the entry was last written, for ordering the picker most-recent-first. */
    readonly modified: string;
}

/**
 * The app's door to stored projects, in DOMAIN vocabulary.
 *
 * Every method takes or returns an `OpenISDProject` or plain data — never a record — so no caller
 * can see the stored shape, and a change to that shape cannot reach the app.
 *
 * DEPENDS ON the `RecordStore` handed to `projectRepo()`, and on this module's privileged
 * access to a project's own record. Both are why it lives here rather than in an app package.
 *
 * ASSUMES identity comes from the project itself (`OpenISDProject.uuid()`) and is in-memory only,
 * never carried in the record — so the repo supplies the key on every call, and a record on its
 * own names nothing.
 */
export interface ProjectRepo {
    /**
     * Write `project`'s current design to the store under its own uuid, replacing any entry there.
     *
     * PERSISTS the edit layer if one is open, else committed — never an open what-if, which is
     * exploratory and must not survive the session. There is no layer parameter, so no call site
     * can persist the wrong thing.
     *
     * WHY IT EXISTS — AUTOSAVE: the user types a box volume, is called away, and the browser
     * discards the tab. On return the design is still there. Today the app has no answer to that:
     * work between explicit File → Save actions is simply lost.
     *
     * Autosave is this method plus a TRIGGER — the project's own change notification calling it.
     * The trigger is still undecided (QO92: every change, debounced, or on blur), and the same
     * method serves an explicit toolbar Save. WHAT is written is settled here; WHEN is not.
     */
    save(project: OpenISDProject): void;

    /**
     * Rebuild the project stored under `id` as a fresh `OpenISDProject`, with nothing edited.
     *
     * RETURNS the problems rather than throwing, so a caller listing projects can show WHY a row
     * cannot be opened instead of failing on click.
     *
     * ADOPTS `id` AS THE PROJECT'S IDENTITY. A store key was minted in this process, so restoring
     * it is not importing a foreign id — and it is what makes reopening idempotent: the project's
     * next save writes back to the entry it came from. Opening one entry twice therefore yields two
     * handles on the SAME identity, which a workspace should collapse by focusing what is already
     * open rather than loading a second copy. (A FILE import still mints: a file's id is provenance,
     * never a key — the driver precedent, QO81.)
     *
     * WHY IT EXISTS: the user picks "Ported 8in v3" from the list and expects the design back as
     * they left it, editable. It is also the reload path.
     */
    load(id: string): OpenISDProject | string[];

    /**
     * Everything the store holds, most-recently-modified first.
     *
     * WHY IT EXISTS: the picker opens with forty designs stored and must render immediately.
     * Without a listing the only way to show it is to load all forty — the whole cost of opening
     * every design, paid to render forty lines of text.
     */
    list(): ProjectListing[];

    /**
     * Delete the stored entry for `id`, but ONLY after `confirm` agrees.
     *
     * Deletion is final: no archive, no undo, and once the user has no file there is no copy left
     * anywhere. So the challenge is a PARAMETER, not a convention — there is no overload without
     * it and no call site can forget it (John 2026-08-26). What the UI must put in that dialog:
     *
     *   1. OFFER EXPORT FIRST, as the default action — deletion is only safe once the design exists
     *      somewhere else, and the moment to say so is before it is gone.
     *   2. DEMAND A TYPED 3-DIGIT NUMBER, generated per dialog. A button can be clicked reflexively
     *      and a checkbox ticked without reading; typing digits cannot be done by muscle memory,
     *      which forces the user to look at WHICH project the dialog names. Generated rather than
     *      fixed, or regular users learn it and it decays back into a button.
     *
     * `confirm` RECEIVES THE STORED ENTRY, so the dialog names what is really about to be destroyed
     * rather than what the caller believed it was pointing at. It is called ONLY when the entry is
     * found: a dialog about a project that is already gone teaches users to dismiss dialogs unread.
     *
     * Deliberately harsher than the CLOSE challenge, which offers three named outcomes and no
     * typing. Closing loses work since the last file save; this destroys the stored copy too.
     *
     * WHY IT EXISTS: a store that only ever grows eventually hits its quota, and the first symptom
     * is saves silently failing. The user needs to throw away the experiments they no longer want.
     */
    remove(id: string, confirm: DeleteChallenge): Promise<DeleteOutcome>;
}

/**
 * Build a repo over the store `make` produces.
 *
 * THE FACTORY IS INSTANTIATED HERE, at the private record type. So the caller supplies a store
 * without ever learning what it will hold, and this module fixes the type without the caller
 * being able to name it — the boundary is enforced by parametricity, not by a naming rule, and
 * no cast appears anywhere.
 *
 * The store is held by the returned repo, NOT in module scope. A module-scoped store would have
 * to be installed exactly once, which makes a second repo impossible to create and the package
 * impossible to test — a test would need a reset backdoor that ships in production code. Passing
 * it in costs one argument at the composition root and removes the global entirely.
 *
 * ASSUMES the composition root builds ONE repo and shares it. Two repos over two factories are
 * two stores; over IndexedDB they would address the same database, but nothing here enforces
 * that, and nothing needs to — deciding what exists once is what a composition root is for.
 */
export function projectRepo(make: RecordStoreFactory, engine: Engine): ProjectRepo {
    const store = make<OpenISDProjectJson>('meta.name');
    return {
        save(project: OpenISDProject): void {
            project.save();
            const json = project.cloneSavedProject();
            store.put(project.uuid(), json);
        },

        load(id: string): OpenISDProject | string[] {
            const stored = store.get(id);
            if (!stored) return [`no stored project with id ${id}`];
            // THE LOAD BOUNDARY (QO116): `stored` is `R` only by the store's own type parameter, a
            // compile-time promise nothing at runtime enforced on whatever is actually behind it.
            // One `.safeParse()` here validates the WHOLE project record before anything downstream
            // ever sees it — never a per-section check, per QO116 ("validate the whole project in
            // a single .parse() at the load boundary. Not three standalone schemas").
            const result = openISDProjectJsonSchema.safeParse(stored);
            if (!result.success) {
                return result.error.issues.map(issue => issue.path.length === 0
                    ? issue.message
                    : `'${issue.path.join('.')}': ${issue.message}`);
            }
            // ADOPTS `id` as the project's identity, so its next save writes back to the entry it came
            // from rather than minting a second one. See `wrapWithIdentity()`.
            return OpenISDProject.wrapWithIdentity(result.data, id, engine);
        },

        list(): ProjectListing[] {
            return store.list()
                .map(e => ({id: e.id, name: e.label, modified: e.modified}))
                .sort((a, b) => (a.modified < b.modified ? 1 : a.modified > b.modified ? -1 : 0));
        },

        async remove(id: string, confirm: DeleteChallenge): Promise<DeleteOutcome> {
            // FOUND FIRST, then challenge: there is nothing to name and nothing to lose when `id`
            // matches nothing, and the listing is what gives the dialog the real entry to show.
            const entry = this.list().find(e => e.id === id);
            if (!entry) return 'absent';
            if (!await confirm(entry)) return 'declined';
            store.remove(id);
            return 'deleted';
        },
    };
}
