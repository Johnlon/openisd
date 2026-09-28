import { SetOnlyFieldImpl, enteredCell, focus } from '../cell.js';
import type { Entered, Readable, SimpleField, Writable } from '../cell.js';
import type { OpenISDProjectJson } from '../openisdSchema.js';

/** A project's own metadata window, built fresh on every access from `lens` — same reasoning as
 *  `driver`/`box` on `OpenISDProject` (PLAN_openisdproject_split.md). No engine: nothing here
 *  reads or derives anything, it only addresses one slot of the record. */
export class ProjectMeta {
    static wrap(lens: SimpleField<OpenISDProjectJson['meta']>): ProjectMeta {
        return new ProjectMeta(lens);
    }

    readonly #lens: SimpleField<OpenISDProjectJson['meta']>;

    private constructor(lens: SimpleField<OpenISDProjectJson['meta']>) {
        this.#lens = lens;
    }

    /** What the user calls this project. A LABEL, not an identity — two projects may share one,
     *  which is exactly why `OpenISDProject.uuid()` exists. */
    get name(): SimpleField<string> {
        return focus(this.#lens, 'name');
    }

    /** WinISD Project tab: who made this project, and when. */
    get creator(): SimpleField<string> {
        return focus(this.#lens, 'creator');
    }

    get created(): SimpleField<string> {
        return focus(this.#lens, 'created');
    }

    get modified(): SimpleField<string> {
        return focus(this.#lens, 'modified');
    }

    /** WinISD Project tab: the user's own note about this project. Stored, never interpreted. */
    get description(): Readable<string> & Entered & Writable<string> {
        const lens = this.#lens;
        return new SetOnlyFieldImpl<string>(
            () => enteredCell('description', lens.value.description),
            {
                entered: (v: string) => lens.set({...lens.value, description: v}),
            },
        );
    }
}
