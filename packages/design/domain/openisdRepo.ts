import { OpenISDProject } from './openisdDomain.js';
import { type OpenISDProjectSessionJson, openISDProjectSessionJsonSchema } from './openisdSchema.js';
import type { Engine } from '../engine/index.js';

// ── PERSISTENCE ────────────────────────────────────────────────────────────────────────────
//
// `ProjectRepo` bridges domain objects (`OpenISDProject`) and the injected `RecordStore<R>`.
// By injecting `RecordStore` as a generic factory, the store implementation remains parametric
// and agnostic of `OpenISDProjectJson`, keeping internal schemas private.

/**
 * What a stored project is called, for a picker.
 *
 * PUBLIC on purpose, unlike the record: it is the label a user reads, so hiding it would only
 * force the store to invent a shape it cannot see. Carried ALONGSIDE the record rather than read
 * out of it, because the store is not allowed to look inside.
 */
/**
 * Abstract store interface keyed by string ID.
 *
 * Parametric over `R` to ensure the storage layer operates without inspecting or
 * depending on internal domain schemas. Assumes records are structured values.
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
    /** The store key (UUID) used for `load()` and `remove()`. */
    readonly id: string;
    /** The project's name. A LABEL, never an identity: two entries may share one. */
    readonly name: string;
    /** When the entry was last written, for ordering the picker most-recent-first. */
    readonly modified: string;
}

/**
 * Application interface for stored projects.
 *
 * Uses domain objects (`OpenISDProject`) exclusively to hide internal JSON structures.
 * Identifies projects by their transient in-memory UUIDs.
 */
export interface ProjectRepo {
    /**
     * Persists the project's state (saved and edit) by UUID.
     */
    save(project: OpenISDProject): void;

    /**
     * Rebuilds `OpenISDProject` from storage without throwing, returning parse errors if invalid.
     * Adopts the stored `id` as the project's identity for idempotency.
     */
    load(id: string): OpenISDProject | string[];

    /**
     * Retrieves metadata for all stored projects, ordered by most recently modified.
     */
    list(): ProjectListing[];

    /**
     * Irreversibly deletes the stored entry for `id` if the `confirm` challenge succeeds.
     */
    remove(id: string, confirm: DeleteChallenge): Promise<DeleteOutcome>;
}

/**
 * Instantiates a `ProjectRepo` over the provided generic `RecordStoreFactory`.
 * Encapsulates the `OpenISDProjectJson` type so callers do not need to name it.
 */
export function projectRepo(make: RecordStoreFactory, engine: Engine): ProjectRepo {
    const store = make<OpenISDProjectSessionJson>('label');
    return {
        save(project: OpenISDProject): void {
            const session = project.cloneSession();
            store.put(project.uuid(), session);
        },

        load(id: string): OpenISDProject | string[] {
            const stored = store.get(id);
            if (!stored) return [`no stored project with id ${id}`];
            
            const result = openISDProjectSessionJsonSchema.safeParse(stored);
            if (!result.success) {
                return result.error.issues.map(issue => issue.path.length === 0
                    ? issue.message
                    : `'${issue.path.join('.')}': ${issue.message}`);
            }
            return OpenISDProject.wrapSession(result.data, id, engine);
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
