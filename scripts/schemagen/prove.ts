/**
 * The proof: the Zod master and the generated pydantic module give the SAME output over every
 * case — the same accept/refuse verdict, the same parsed result, the same problem paths.
 */
import {spawnSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import type {z} from 'zod';
import type {Case} from './cases.js';

export interface Verdict {
    readonly id: string;
    readonly verdict: 'accept' | 'refuse';
    readonly result?: unknown;
    readonly problems?: readonly string[];
}

/** Zod's issues as problem paths: one path per unrecognised key, else the issue's own path. */
function problemPaths(error: z.ZodError): string[] {
    const paths = new Set<string>();
    for (const issue of error.issues) {
        const path = issue.path.map(String);
        if (issue.code === 'unrecognized_keys') for (const key of issue.keys) paths.add([...path, key].join('.'));
        else paths.add(path.join('.'));
    }
    return [...paths].sort();
}

export function zodVerdicts(schema: z.ZodType, cases: readonly Case[]): Verdict[] {
    return cases.map(c => {
        const r = schema.safeParse(c.input);
        if (r.success) return {id: c.id, verdict: 'accept', result: JSON.parse(JSON.stringify(r.data))};
        return {id: c.id, verdict: 'refuse', problems: problemPaths(r.error)};
    });
}

/** Parses the Python runner's results file into verdicts, refusing any row that is not one. */
function verdictsFrom(text: string): Verdict[] {
    const rows: unknown = JSON.parse(text);
    if (!Array.isArray(rows)) throw new Error('python results: not a list');
    return rows.map((row: unknown): Verdict => {
        if (typeof row !== 'object' || row === null) throw new Error('python results: row is not an object');
        const r: Record<string, unknown> = Object.fromEntries(Object.entries(row));
        const {id, verdict, result, problems} = r;
        if (typeof id !== 'string') throw new Error('python results: id');
        if (verdict === 'accept') return {id, verdict, result};
        if (verdict === 'refuse' && Array.isArray(problems) && problems.every((p): p is string => typeof p === 'string')) return {id, verdict, problems};
        throw new Error(`python results: bad row for ${id}`);
    });
}

export function pydanticVerdicts(runner: string, modulePath: string, cases: readonly Case[], casesPath: string, resultsPath: string): Verdict[] {
    writeFileSync(casesPath, JSON.stringify(cases));
    const run = spawnSync('python3', ['-I', runner, modulePath, casesPath, resultsPath], {encoding: 'utf-8', maxBuffer: 1 << 28});
    if (run.status !== 0) throw new Error(`python runner failed (exit ${run.status}):\n${run.stderr}`);
    return verdictsFrom(readFileSync(resultsPath, 'utf-8'));
}

export interface Difference { readonly id: string; readonly what: string }

export function differences(zod: readonly Verdict[], pydantic: readonly Verdict[]): Difference[] {
    const byId = new Map(pydantic.map(v => [v.id, v]));
    const out: Difference[] = [];
    for (const a of zod) {
        const b = byId.get(a.id);
        if (b === undefined) { out.push({id: a.id, what: 'no pydantic verdict'}); continue; }
        if (a.verdict !== b.verdict) {
            out.push({id: a.id, what: `zod ${a.verdict} ${a.problems?.join(', ') ?? ''} / pydantic ${b.verdict} ${b.problems?.join(', ') ?? ''}`});
        } else if (a.verdict === 'accept') {
            if (!isDeepStrictEqual(a.result, b.result)) out.push({id: a.id, what: `parsed results differ:\n  zod      ${JSON.stringify(a.result)}\n  pydantic ${JSON.stringify(b.result)}`});
        } else if (!isDeepStrictEqual(a.problems, b.problems)) {
            out.push({id: a.id, what: `problem paths differ:\n  zod      ${a.problems?.join(', ')}\n  pydantic ${b.problems?.join(', ')}`});
        }
    }
    return out;
}
