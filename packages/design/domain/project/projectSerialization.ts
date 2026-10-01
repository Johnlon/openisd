import { openISDProjectSessionJsonSchema } from '../openisdSchema.js';
import type { OpenISDProjectJson, OpenISDProjectSessionJson } from '../openisdSchema.js';
import { parseRepairing, type Repaired } from '../schemaRepair.js';

/** Serialises saved and ordinary edited states for persistence. The transient what-if is absent. */
export function sessionOf(name: string, saved: OpenISDProjectJson, edited: OpenISDProjectJson | null): OpenISDProjectSessionJson {
    return {
        label: name,
        saved: structuredClone(saved),
        edited: edited ? structuredClone(edited) : null,
    };
}

/** A session as `.owpr` text — openisd's own format. Lossless: there is nothing to drop and no
 *  error to report. */
export function owprTextOf(session: OpenISDProjectSessionJson): string {
    return JSON.stringify(session, null, 2);
}

/** `.owpr` text parsed and validated, or everything wrong with it. Stops short of building an
 *  `OpenISDProject`: minting its identity and attaching the engine is
 *  `OpenISDProject.fromOwprText`'s own job, not this function's. */
export function parseOwprSession(text: string): { session: OpenISDProjectSessionJson } | { errors: string[] } {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return {errors: ['not valid JSON']};
    }
    const result = openISDProjectSessionJsonSchema.safeParse(parsed);
    if (!result.success) {
        return {errors: result.error.issues.map(issue => issue.path.length === 0
            ? issue.message
            : `'${issue.path.join('.')}': ${issue.message}`)};
    }
    return {session: result.data};
}

/** `.owpr` text parsed with every failing field removed so its default applies, and which ones
 *  were; refused only when the text is not JSON or not a project session at all. */
export function parseOwprSessionRepairing(text: string): Repaired<OpenISDProjectSessionJson> | string[] {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return ['not valid JSON'];
    }
    return parseRepairing(openISDProjectSessionJsonSchema, parsed);
}
