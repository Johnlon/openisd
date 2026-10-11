/**
 * The schema reconciliation program (plan PLAN_20261010_HIGH_FIDELITY_EXTRACTION section 2):
 * writes the pydantic driver-record model from the Zod master and proves the two give the same
 * output, or stops naming the construct or the input. It never leaves a partial output: the
 * module is written to `out/driver_model.py` only after the proof passes.
 *
 *   npx tsx scripts/schemagen/main.ts            (from the repo root)
 *
 * Exit 0: proven and written. 2: a construct the translator does not know. 1: a difference.
 */
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {openISDDeviceJsonSchema} from '../../packages/design/domain/openisdSchema.js';
import {edgeCases, recordCases} from './cases.js';
import {differences, pydanticVerdicts, zodVerdicts} from './prove.js';
import {Untranslated, pythonModuleFor} from './translate.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
export const MASTER = 'packages/design/domain/openisdSchema.ts';
export const SCHEMA_NAME = 'openISDDeviceJsonSchema';
export const OUTPUT = join(HERE, 'out', 'driver_model.py');
const CORPUS = join(ROOT, '..', 'winisd_drivers', 'db');
const FIXTURES = join(ROOT, 'packages', 'design', 'test');

/** The generated module text, from the master as it is now. */
export function generate(): string {
    return pythonModuleFor(join(ROOT, 'packages', 'design', 'tsconfig.json'), join(ROOT, MASTER), SCHEMA_NAME, MASTER);
}

function main(): number {
    const t0 = Date.now();
    const lap = (label: string) => console.log(`${label}: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    let moduleText: string;
    try {
        moduleText = generate();
    } catch (e) {
        if (e instanceof Untranslated) { console.error(`STOP: cannot translate ${e.message}`); return 2; }
        throw e;
    }
    lap('translated');
    const work = mkdtempSync(join(tmpdir(), 'schemagen-'));
    try {
        const modulePath = join(work, 'driver_model.py');
        writeFileSync(modulePath, moduleText);
        const corpus = recordCases(CORPUS, 'corpus');
        const fixtures = recordCases(FIXTURES, 'fixture');
        const unreadable = [...corpus.unreadable, ...fixtures.unreadable];
        if (unreadable.length > 0) {
            console.log(`${unreadable.length} record file(s) are not JSON/YAML at all, so no schema sees them (not cases):`);
            for (const u of unreadable) console.log(`  ${u.path}: ${u.reason}`);
        }
        const cases = [...corpus.cases, ...fixtures.cases, ...edgeCases()];
        lap('cases collected');
        const zod = zodVerdicts(openISDDeviceJsonSchema, cases);
        lap('zod run');
        const pydantic = pydanticVerdicts(join(HERE, 'validate.py'), modulePath, cases, join(work, 'cases.json'), join(work, 'results.json'));
        lap('pydantic run');
        const diffs = differences(zod, pydantic);
        const accepted = zod.filter(v => v.verdict === 'accept').length;
        console.log(`cases: ${cases.length} (corpus ${cases.filter(c => c.id.startsWith('corpus:')).length}, fixtures ${cases.filter(c => c.id.startsWith('fixture:')).length}, edge ${cases.filter(c => c.id.startsWith('edge:')).length}); zod accepts ${accepted}, refuses ${cases.length - accepted}`);
        if (diffs.length > 0) {
            console.error(`STOP: ${diffs.length} difference(s); nothing written. First ${Math.min(diffs.length, 20)}:`);
            for (const d of diffs.slice(0, 20)) console.error(`- ${d.id}: ${d.what}`);
            return 1;
        }
        mkdirSync(dirname(OUTPUT), {recursive: true});
        writeFileSync(OUTPUT, moduleText);
        console.log(`proven: 0 differences; wrote ${OUTPUT}`);
        return 0;
    } finally {
        rmSync(work, {recursive: true, force: true});
    }
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(main());
