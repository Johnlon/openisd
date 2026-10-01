import type {z} from 'zod';

/** Where a field sits in a stored record: the keys from the record's root down to it. */
export type FieldPath = readonly (string | number)[];

/** A record that parsed after `repaired` fields were removed so their defaults apply. */
export interface Repaired<T> {
    readonly value: T;
    readonly repaired: readonly FieldPath[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** The issue's path as record keys, or null when it holds a symbol (not a stored key). */
function keysOf(path: readonly PropertyKey[]): FieldPath | null {
    const keys: (string | number)[] = [];
    for (const key of path) {
        if (typeof key === 'symbol') return null;
        keys.push(key);
    }
    return keys;
}

function valueAt(root: unknown, path: FieldPath): unknown {
    let here = root;
    for (const key of path) {
        if (Array.isArray(here) && typeof key === 'number') here = here[key];
        else if (isRecord(here) && typeof key === 'string') here = here[key];
        else return undefined;
    }
    return here;
}

/** Remove the value at `path`. False when there is nothing there to remove. */
function removeAt(root: unknown, path: FieldPath): boolean {
    const last = path[path.length - 1];
    const parent = valueAt(root, path.slice(0, -1));
    if (Array.isArray(parent) && typeof last === 'number' && last < parent.length) {
        parent.splice(last, 1);
        return true;
    }
    if (isRecord(parent) && typeof last === 'string' && last in parent) {
        return Reflect.deleteProperty(parent, last);
    }
    return false;
}

function messagesOf(issues: readonly z.core.$ZodIssue[]): string[] {
    return issues.map(issue => issue.path.length === 0
        ? issue.message
        : `'${issue.path.join('.')}': ${issue.message}`);
}

/**
 * Parse `input` against `schema`, removing each field that fails so the schema's own default
 * (or absence) applies, until it parses. A missing required field removes its parent instead.
 * Refused (the messages) only when the failure is at the record's root — the input is not this
 * kind of record at all.
 */
export function parseRepairing<S extends z.ZodType>(schema: S, input: unknown): Repaired<z.output<S>> | string[] {
    const working: unknown = structuredClone(input);
    const repaired: FieldPath[] = [];
    for (;;) {
        const result = schema.safeParse(working);
        if (result.success) return {value: result.data, repaired};
        let progressed = false;
        for (const issue of result.error.issues) {
            const path = keysOf(issue.path);
            if (path === null) return messagesOf(result.error.issues);
            const targets: FieldPath[] = issue.code === 'unrecognized_keys'
                ? issue.keys.map(key => [...path, key])
                : [path];
            for (const target of targets) {
                if (target.length === 0) return messagesOf(result.error.issues);
                if (removeAt(working, target)) {
                    repaired.push(target);
                    progressed = true;
                } else if (target.length > 1 && removeAt(working, target.slice(0, -1))) {
                    repaired.push(target.slice(0, -1));
                    progressed = true;
                }
            }
        }
        if (!progressed) return messagesOf(result.error.issues);
    }
}
