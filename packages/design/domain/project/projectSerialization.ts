import { openISDProjectSessionJsonSchema } from '../openisdSchema.js';
import { withSlimModel } from '../slimModel.js';
import { withMovedChamberQicl } from './movedChamberQicl.js';
import { CURRENT_SCHEMA_VERSION, upgradeToCurrent } from '../schemaVersion.js';
import type { OpenISDProjectJson, OpenISDProjectSessionJson } from '../openisdSchema.js';
import { parseRepairing, type Repaired } from '../schemaRepair.js';
import { withoutDerivedMarks } from '../derivedMarks.js';
import { retireLossMode } from './retiredLossMode.js';
import { singleEnteredVentPairs } from './singleEnteredVentPairs.js';

/** Serialises saved and ordinary edited states for persistence. The transient what-if is absent. */
export function sessionOf(id: string, name: string, saved: OpenISDProjectJson, edited: OpenISDProjectJson | null): OpenISDProjectSessionJson {
    return {
        id,
        label: name,
        saved: structuredClone(saved),
        edited: edited ? structuredClone(edited) : null,
    };
}

/** The session with its keys in the schema's order, so one project is always one text however its
 *  records were built (a converter, an edit, a load). What the schema does not accept comes back
 *  as it was: the repo that owns the text reports it. */
function canonicalOrNull(session: unknown): unknown {
    const stamped = isRecord(session) ? {...session, schemaVersion: CURRENT_SCHEMA_VERSION} : session;
    const result = openISDProjectSessionJsonSchema.safeParse(stamped);
    return result.success ? result.data : null;
}

function canonicalSession(session: unknown): unknown {
    return canonicalOrNull(session) ?? session;
}

/** A session as `.owpr` text — openisd's own format. Lossless: there is nothing to drop and no
 *  error to report. */
export function owprTextOf(session: OpenISDProjectSessionJson): string {
    return JSON.stringify(canonicalSession(session), withoutDerivedMarks, 2);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A session as the text browser storage holds it: one compact line, without what the load
 *  works out again. `.owpr` files keep their indented form with everything in it. */
export function storedTextOf(session: OpenISDProjectSessionJson): string {
    return JSON.stringify(canonicalSession(session), withoutDerivedMarks);
}

/** A text written before projects carried an id gets one here, once, when it is read; a text
 *  that has one is returned as it was. */
function withProjectId(parsed: unknown, newId: () => string): unknown {
    return isRecord(parsed) && !('id' in parsed) ? {id: newId(), ...parsed} : parsed;
}

/** A stored or `.owpr` project text as `storedTextOf` writes it; null when the text is not a
 *  project session, which the repo that owns it reports and this leaves untouched. */
export function compactedStoredText(text: string): string | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return null;
    }
    if (!isRecord(parsed) || !isRecord(parsed.saved)) return null;
    const upgraded = upgradeToCurrent(parsed);
    if ('refusal' in upgraded) return null;
    const canonical = canonicalOrNull(upgraded.value) ?? withSlimModel(parsed);
    return JSON.stringify(canonical, withoutDerivedMarks);
}

/** `.owpr` text parsed and validated, or everything wrong with it. Stops short of building an
 *  `OpenISDProject`: minting its identity and attaching the engine is
 *  `OpenISDProject.fromOwprText`'s own job, not this function's. */
export function parseOwprSession(text: string, newId: () => string): { session: OpenISDProjectSessionJson } | { errors: string[] } {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return {errors: ['not valid JSON']};
    }
    const upgraded = upgradeToCurrent(withProjectId(parsed, newId));
    if ('refusal' in upgraded) return {errors: [upgraded.refusal]};
    const result = openISDProjectSessionJsonSchema.safeParse(withMovedChamberQicl(upgraded.value));
    if (!result.success) {
        return {errors: result.error.issues.map(issue => issue.path.length === 0
            ? issue.message
            : `'${issue.path.join('.')}': ${issue.message}`)};
    }
    return {session: singleEnteredVentPairs(retireLossMode(result.data).session).session};
}

import {withoutImportSku} from './withoutImportSku.js';

/** `.owpr` text parsed with every failing field removed so its default applies, and which ones
 *  were; refused only when the text is not JSON or not a project session at all. */
export function parseOwprSessionRepairing(text: string, newId: () => string): Repaired<OpenISDProjectSessionJson> | string[] {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return ['not valid JSON'];
    }
    const upgraded = upgradeToCurrent(withProjectId(parsed, newId));
    if ('refusal' in upgraded) return [upgraded.refusal];
    const repaired = parseRepairing(openISDProjectSessionJsonSchema, withMovedChamberQicl(upgraded.value));
    if (Array.isArray(repaired)) return repaired;
    const retired = retireLossMode(repaired.value);
    const paired = singleEnteredVentPairs(retired.session);
    const unstated = withoutImportSku(paired.session);
    return {value: unstated.session, repaired: [...repaired.repaired, ...retired.repaired, ...paired.repaired, ...unstated.repaired]};
}
