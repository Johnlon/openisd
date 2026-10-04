// THIS GATE EXISTS TO CATCH THE AI. THAT IS ITS WHOLE PURPOSE.
//
// There is no other author here. Every failure it reports is the agent's own mistake, caught by a
// check the agent could not run in its own head. A red result IS the finding — never an obstacle
// standing in front of one.
//
// Two permitted responses when it goes red. ONE: name the defect in a sentence — what is actually
// wrong with the code, that would still be wrong if this gate did not exist — and then repair it.
// If no defect can be named, that option is not available. TWO: STOP and report what it found.
// "Make it pass" is not one of the two, and is what the word "fix" quietly permits. Casting
// past it, renaming so a matcher stops firing, adding an exemption, loosening the assertion or
// deleting the test are one act under different names — making the red go away instead of making
// the code right. After ANY edit to this file, break what it guards and watch it fail, or it is
// not known to test anything. See AGENTS.md "Every architecture test exists to catch the AI".

/**
 * The provenance panel tells a user WHICH formula produced a value. `PROVENANCE_MAP` is a
 * hand-written list and the solver's routes are `new SolveRoute(...)` entries in
 * `driver/routes/*.ts`, so the two are separate statements of one fact and drift apart silently. When they drift the
 * panel does not merely go quiet — it names a derivation that did not happen, which is worse than
 * showing nothing.
 *
 * The engine side is read from the route files' AST, never from a number copied into this file: a
 * hand-maintained count here would be the same defect relocated, and would go stale the same way.
 *
 * `Fs` is pinned from BOTH sides against the same five input signatures: what the panel declares,
 * and what the engine derives. Pinning only the panel would let a sixth engine route appear
 * unnoticed; pinning both means a change to either fails here until the other is made in the same
 * commit.
 *
 * The other 31 fields in `PROVENANCE_MAP` are NOT yet held to this, and most of them currently
 * diverge. Extending the check field by field is real work per field — each one's routes have to
 * be read off the solver and confirmed — and a blanket assertion written without doing that work
 * would either fail on differences that are not defects or be quietly weakened until it passed.
 */
import {describe, it, vi} from 'vitest';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {readdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {Node, Project as TsProject} from 'ts-morph';
import {getProvenanceInfo, PROVENANCE_MAP} from '../../src/logic/provenance.js';

describe('provenance — driver field provenance inspector', () => {
  it('defines provenance mapping for core T/S parameters', () => {
    assert.ok(PROVENANCE_MAP.Qts, 'Qts must have provenance information');
    assert.ok(PROVENANCE_MAP.Qes, 'Qes must have provenance information');
    assert.ok(PROVENANCE_MAP.Fs_hz, 'Fs must have provenance information');
    assert.ok(PROVENANCE_MAP.Mms_kg, 'Mms must have provenance information');
  });

  it('returns single formula path for single-derivation fields like Qts', () => {
    const info = getProvenanceInfo('Qts');
    assert.ok(info, 'Qts info must exist');
    assert.equal(info.paths.length, 1);
    assert.deepEqual(info.paths[0].inputs, ['Qes', 'Qms']);
    assert.match(info.paths[0].formulaText, /Qes/);
  });

  it('returns multi-path derivations for dual-formula fields like Qes and Mms', () => {
    const qesInfo = getProvenanceInfo('Qes');
    assert.ok(qesInfo, 'Qes info must exist');
    assert.ok(qesInfo.paths.length >= 2, 'Qes must have at least 2 derivation paths');

    const mmsInfo = getProvenanceInfo('Mms_kg');
    assert.ok(mmsInfo, 'Mms info must exist');
    assert.ok(mmsInfo.paths.length >= 2, 'Mms must have at least 2 derivation paths');
    assert.notEqual(mmsInfo.paths[0].color, mmsInfo.paths[1].color, 'Each path must carry a distinct color');
  });

  /* The inspector tells the user how a value was reached, so a path that names inputs the
   * engine does not actually use is a lie about our own code. Rme takes 2π·Fs·Mms/Qes in
   * preference to Bl²/Re (engine driver.ts block 13), and Mpow is √Rme so that it cannot
   * print a number contradicting the Rme beside it. */
  it('the Advanced figures of merit name the inputs the engine really uses', () => {
    assert.deepEqual(getProvenanceInfo('Rme_kg_per_s')?.paths[0].inputs, ['Fs_hz', 'Mms_kg', 'Qes']);
    assert.deepEqual(getProvenanceInfo('gamma_m_per_s2_A')?.paths[0].inputs, ['BL_Tm', 'Mms_kg']);
    assert.deepEqual(getProvenanceInfo('Mpow_N_per_sqrtW')?.paths[0].inputs, ['Rme_kg_per_s'],
      'Mpow is derived from Rme, not independently from Bl and Re');
    assert.deepEqual(getProvenanceInfo('SPLmax_dB')?.paths[0].inputs, ['SPL_dB', 'Pe_W']);
    assert.match(getProvenanceInfo('SPLmax_dB')?.paths[0].formulaText ?? '', /Pe_W/);
  });

  it('substitutes live values into formula text', () => {
    const info = getProvenanceInfo('Qts', { Qes: 0.4, Qms: 4.0 });
    assert.ok(info);
    const sub = info.paths[0].substitutedText ?? '';
    assert.match(sub, /0.4/);
    assert.match(sub, /4/);
  });

  it('every provenance-map key resolves through the direct lookup', () => {
    for (const key of Object.keys(PROVENANCE_MAP)) {
      const info = getProvenanceInfo(key);
      assert.ok(info, `Expected provenance info for key "${key}"`);
    }
  });
});

vi.setConfig({ testTimeout: 60_000 });

const UI_PKG = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROUTES_DIR = join(UI_PKG, '..', 'design', 'engine', 'driver', 'routes');

let cached: Map<string, Set<string>> | null = null;

/**
 * Every distinct route the solver has for each field: field name → set of input signatures,
 * each signature the sorted input names of one route joined by `+`.
 *
 * A route is a `new SolveRoute('Fs_hz', ['Mms_kg', 'Cms_m_per_N'], …)` expression: its first
 * argument names the quantity it derives and its second lists the inputs it requires. Reading
 * the expressions is what makes the result a set of ROUTES rather than a count of SITES: two
 * routes with the same inputs for one target collapse to one entry, which is what the panel
 * should declare.
 */
/** The record's name for an engine quantity: `Fs_hz` → `Fs`, `Cms_m_per_N` → `Cms`.
 *
 *  The engine carries the SI unit in the identifier and the provenance panel names its fields
 *  as the record does, so the two sides are not comparable until one is translated. The suffix
 *  is everything from the first `_`, which is unambiguous because no record spec key contains
 *  one — verified below by the assertion that the walk finds the expected route set. */
const recordName = (quantity: string): string => quantity.split('_')[0];

function engineRoutes(): Map<string, Set<string>> {
  if (cached) return cached;

  const project = new TsProject({ skipAddingFilesFromTsConfig: true });
  const routes = new Map<string, Set<string>>();

  for (const file of readdirSync(ROUTES_DIR).filter(name => name.endsWith('Routes.ts'))) {
    const source = project.addSourceFileAtPath(join(ROUTES_DIR, file));
    for (const node of source.getDescendants()) {
      if (!Node.isNewExpression(node) || node.getExpression().getText() !== 'SolveRoute') continue;
      const [target, inputs] = node.getArguments();
      if (!target || !Node.isStringLiteral(target) || !inputs || !Node.isArrayLiteralExpression(inputs)) continue;
      const field = recordName(target.getLiteralValue());
      const names = inputs.getElements()
        .filter(Node.isStringLiteral)
        .map(element => recordName(element.getLiteralValue()));
      const signature = [...new Set(names)].sort().join('+');
      if (!routes.has(field)) routes.set(field, new Set());
      routes.get(field)!.add(signature);
    }
  }

  cached = routes;
  return routes;
}

describe('the provenance panel declares the routes the engine actually has', () => {
  it('finds the solver assignments it reads from', () => {
    const routes = engineRoutes();
    assert.ok(routes.size > 10,
      `only ${routes.size} derived fields found in driver/routes — the AST read is broken, and a ` +
      'broken read would make every assertion below pass vacuously');
  });

  it('declares exactly the Fs routes the engine derives, with the inputs the engine requires', () => {
    const declared = [...new Set(
      (PROVENANCE_MAP.Fs_hz?.paths ?? []).map(p => [...p.inputs].map(recordName).sort().join('+')))]
      .sort();

    const expected = [
      'BL+Mms+Qes+Re',   // Fs = (Qes × BL²) / (2π × Mms × Re)
      'Cms+Mms',         // Fs = 1 / (2π × √(Cms × Mms))
      'EBP+Qes',         // Fs = EBP × Qes
      'Mms+Qes+Rme',     // Fs = (Rme × Qes) / (2π × Mms)
      'Qes+Vas+no',      // Fs = ∛(no × Qes / (CONST_NO × Vas))
    ];

    assert.deepEqual(declared, expected,
      'the panel must name these five Fs routes and no others');

    assert.deepEqual([...(engineRoutes().get('Fs') ?? [])].sort(), expected,
      'the engine derives Fs by exactly these five routes — if this fails the engine changed, ' +
      'and PROVENANCE_MAP.Fs must change in the SAME commit');
  });
});
