/**
 * The provenance panel tells a user WHICH formula produced a value. `PROVENANCE_MAP` is a
 * hand-written list and the solver's routes are `setVal(...)` calls in `driver.ts` control flow,
 * so the two are separate statements of one fact and drift apart silently. When they drift the
 * panel does not merely go quiet — it names a derivation that did not happen, which is worse than
 * showing nothing.
 *
 * The engine side is read from `driver.ts`'s AST, never from a number copied into this file: a
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
import { describe, it, vi } from 'vitest';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Project as TsProject, Node } from 'ts-morph';
import { PROVENANCE_MAP } from '../../src/logic/provenance.js';

vi.setConfig({ testTimeout: 60_000 });

const UI_PKG = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DRIVER_TS = join(UI_PKG, '..', 'engine', 'src', 'driver.ts');

let cached: Map<string, Set<string>> | null = null;

/**
 * Every distinct route the solver has for each field: field name → set of input signatures,
 * each signature the sorted input names of one route joined by `+`.
 *
 * Two details make this a faithful read of the solver rather than a text count.
 *
 * The solver writes a derived value two ways and BOTH are routes: `setVal('Fs', …)` inside the
 * consistency group, and a plain `r.Znom = …` assignment in the passes that run outside it.
 * Reading only the first form reports a field derived by the second as having no route at all.
 *
 * A route's inputs are read from its ENCLOSING GUARD — `if (r.Fs == null && r.Mms != null &&
 * r.Cms != null)` — not from the assigned expression. The guard names exactly what the route
 * requires, whereas the expression reaches some inputs through locals and helper calls. Reading
 * the guard is also what makes the result a set of ROUTES rather than a count of SITES: the same
 * formula implemented in two passes carries the same guard, so it collapses to one entry, which
 * is what the panel should declare.
 */
function engineRoutes(): Map<string, Set<string>> {
  if (cached) return cached;

  const project = new TsProject({ skipAddingFilesFromTsConfig: true });
  const source = project.addSourceFileAtPath(DRIVER_TS);
  const routes = new Map<string, Set<string>>();

  /** The `r.X != null` names in the `if` guard enclosing this assignment, minus the target. */
  function guardInputs(node: Node, field: string): string | null {
    for (let n: Node | undefined = node; n; n = n.getParent()) {
      if (!Node.isIfStatement(n)) continue;
      const names = new Set<string>();
      for (const d of n.getExpression().getDescendants()) {
        if (Node.isPropertyAccessExpression(d) && d.getExpression().getText() === 'r') {
          names.add(d.getName());
        }
      }
      names.delete(field);
      return [...names].sort().join('+');
    }
    return null;
  }

  const add = (field: string, node: Node) => {
    const signature = guardInputs(node, field);
    if (signature === null) return;
    if (!routes.has(field)) routes.set(field, new Set());
    routes.get(field)!.add(signature);
  };

  for (const node of source.getDescendants()) {
    if (Node.isCallExpression(node) && node.getExpression().getText() === 'setVal') {
      const first = node.getArguments()[0];
      if (first && Node.isStringLiteral(first)) add(first.getLiteralValue(), node);
      continue;
    }
    if (Node.isBinaryExpression(node) && node.getOperatorToken().getText() === '=') {
      const target = node.getLeft();
      if (Node.isPropertyAccessExpression(target) && target.getExpression().getText() === 'r') {
        add(target.getName(), node);
      }
    }
  }

  cached = routes;
  return routes;
}

describe('the provenance panel declares the routes the engine actually has', () => {
  it('finds the solver assignments it reads from', () => {
    const routes = engineRoutes();
    assert.ok(routes.size > 10,
      `only ${routes.size} derived fields found in driver.ts — the AST read is broken, and a ` +
      'broken read would make every assertion below pass vacuously');
  });

  it('declares exactly the Fs routes the engine derives, with the inputs the engine requires', () => {
    const declared = [...new Set(
      (PROVENANCE_MAP.Fs?.paths ?? []).map(p => [...p.inputs].sort().join('+')))].sort();

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
