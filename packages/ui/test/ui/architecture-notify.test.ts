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
 * Every public mutator on `OpenISDProject` notifies (`docs/design/REACTIVITY.md` §"What
 * must be true before objective 2 lands", item 2): "A mutator that forgets is a silently stale
 * UI... worth an architecture gate asserting that every public mutator notifies."
 *
 * Shape under test, via the TypeScript AST (ts-morph) — never text/regex matching on comments:
 * a "mutator" is an instance method whose declared return type is `void` (every read method
 * returns a value; `subscribe` returns a function, not `void`). "Notifies" means the method's
 * own call graph, walked through same-class method calls only (`this.foo(...)`,
 * `this.#foo(...)`), reaches a call to the private `#notify()`. This is REACHABILITY, not
 * runtime-condition awareness — an AST gate cannot evaluate an `if` guard — so a mutator that
 * calls `this.mutate(...)` passes (`mutate`'s own body contains a `this.#notify()` call site),
 * whether or not that call is conditionally guarded at runtime.
 *
 * Known limit of the `void`-return mutator definition: a mutator that returns a VALUE (e.g. a
 * builder-style method returning `this`, or one returning the field it just wrote) would not be
 * classified as a mutator at all and would evade this gate entirely. `cloneSavedProject()` IS
 * such a method today — it returns `OpenISDProjectJson`, and mutates: it cancels an active
 * what-if (`#endWhatIfIfActive()`), which reaches `#notify()`. The gate's void-only filter skips
 * it, so its own reachability check never runs on it; it happens to notify anyway (traced above),
 * which is why the gate's conclusion still holds for the current tree — not because the gate
 * verified it.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Project as TsProject, Node, SyntaxKind } from 'ts-morph';

const DESIGN = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'design');
const DOMAIN_FILE = join(DESIGN, 'domain', 'openisdDomain.ts');

const project = new TsProject({
  tsConfigFilePath: join(DESIGN, 'tsconfig.json'),
  skipAddingFilesFromTsConfig: true,
});
const sourceFile = project.addSourceFileAtPath(DOMAIN_FILE);

const classDecl = sourceFile.getClassOrThrow('OpenISDProject');

/** Every instance method's name (public and private) to member-name text ("notify" for
 *  `#notify`), matching what a `this.foo(...)`/`this.#foo(...)` call site's member name reads
 *  as. Constructors and static methods are excluded — static factories are not instance
 *  mutators and cannot reach an instance's `#notify`. */
function memberNameOf(nameNode: Node): string {
  const text = nameNode.getText();
  return text.startsWith('#') ? text.slice(1) : text;
}

const instanceMethods = classDecl.getMethods().filter(m => !m.isStatic());

/** Every getter whose body returns a window built over `this.#slot(...)` — `driver`, `box`,
 *  `nDrivers` and their siblings. Writing through such a window runs `#slot()`'s own setter,
 *  which calls `#notify()`, so a mutator whose only write is `this.driver.update(...)` DOES
 *  notify even though the call leaves the class. Detected from the getter's own body, not from
 *  a hand-kept list, so a getter that stops going through `#slot` stops conferring the edge. */
const lensGetters = new Set(
  classDecl.getGetAccessors()
    .filter(g => /this\.#slot\(/.test(g.getText()))
    .map(g => memberNameOf(g.getNameNode())),
);

/** `this.foo(...)` / `this.#foo(...)` call sites inside one method's body, as the called
 *  member's name — the edges of the same-class call graph — plus `this.<lensGetter>.foo(...)`,
 *  which reaches `#notify()` through `#slot()`'s setter (see `lensGetters`). A call on anything
 *  else (e.g. a call on a value handed in as a parameter) is deliberately not an edge: it leaves
 *  this class's own call graph, which is exactly the gap this gate exists to catch. */
function sameClassCalleesOf(method: Node): Set<string> {
  const callees = new Set<string>();
  method.forEachDescendant(node => {
    if (!Node.isCallExpression(node)) return;
    const callee = node.getExpression();
    if (!Node.isPropertyAccessExpression(callee)) return;
    const target = callee.getExpression();
    if (target.getKind() === SyntaxKind.ThisKeyword) {
      callees.add(memberNameOf(callee.getNameNode()));
      return;
    }
    // `this.driver.update(...)` — a call on a lens window. The write runs #slot()'s setter.
    if (!Node.isPropertyAccessExpression(target)) return;
    if (target.getExpression().getKind() !== SyntaxKind.ThisKeyword) return;
    if (lensGetters.has(memberNameOf(target.getNameNode()))) callees.add('notify');
  });
  return callees;
}

const callGraph = new Map<string, Set<string>>();
for (const m of instanceMethods) {
  callGraph.set(memberNameOf(m.getNameNode()), sameClassCalleesOf(m));
}

/** Does `startMethodName`'s call graph, walked transitively through same-class method calls,
 *  reach a call to `#notify`? */
function reachesNotify(startMethodName: string): boolean {
  const seen = new Set<string>();
  const stack = [startMethodName];
  while (stack.length) {
    const current = stack.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    const callees = callGraph.get(current);
    if (!callees) continue; // a call to something outside this class (e.g. the driver) — a dead end
    if (callees.has('notify')) return true;
    for (const callee of callees) if (!seen.has(callee)) stack.push(callee);
  }
  return false;
}

/** A "mutator": a public (non-`#`) instance method that returns `void` AND whose body contains
 *  at least one statement. Every read method on `OpenISDProject` returns a value (`number`,
 *  `boolean`, `Cell`, a driver field type, ...); `subscribe` returns `() => void`, a function,
 *  not `void` itself.
 *
 *  An EMPTY body is excluded because it writes nothing — there is no state change for a
 *  notification to accompany, so demanding one would report a defect that does not exist.
 *  `solveVentGroup`/`solvePrGroup` are such stubs today (QO126). The moment either grows a body
 *  it becomes a mutator again and must reach `#notify()` like every other. */
const publicMutators = instanceMethods.filter(m => {
  const name = m.getNameNode().getText();
  if (name.startsWith('#')) return false;
  if (m.getReturnType().getText() !== 'void') return false;
  return (m.getBody()?.getDescendantStatements().length ?? 0) > 0;
});

describe('every public mutator on OpenISDProject notifies', () => {
  it('finds at least one public mutator — a gate over zero mutators would pass vacuously', () => {
    assert.ok(publicMutators.length > 0, 'no public void-returning instance method found');
  });

  it('every public mutator\'s call graph reaches #notify()', () => {
    const offenders = publicMutators
      .map(m => m.getNameNode().getText())
      .filter(name => !reachesNotify(name));
    assert.deepEqual(
      offenders, [],
      `these public mutators never reach #notify() through any same-class call: ${offenders.join(', ')}`,
    );
  });
});
