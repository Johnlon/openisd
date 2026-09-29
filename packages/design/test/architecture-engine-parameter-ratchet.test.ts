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
 * THE ENGINE IS NOT THREADED THROUGH PARAMETERS. Dependency injection means a component is
 * CONSTRUCTED with the engine (or the one engine area it uses) and holds it; a free function
 * taking `engine: Engine` is the opposite — every caller has to have an engine to hand, so the
 * engine spreads to APIs that have no business with it. John, 2026-09-28: "instead of cohesive
 * components into which the engine can be injected, it creates a myriad of independent global
 * methods that need the engine injected … DI means less coupling, not more."
 *
 * Constructors are the one legitimate `engine` parameter and are not counted. A static factory
 * that is a constructor in effect is not counted either (John, 2026-09-29: "if they are genuine
 * constructors the engine is allowed"): a static method whose body constructs its own class, or a
 * subclass declared in the same file, or calls such a factory of that family. A static that hands
 * the engine to some other class is counted.
 *
 * A RATCHET: `ENGINE_PARAMETER_BASELINE` is the list on the day the gate landed. A new site
 * fails; a repaired one must be struck, so the list only shrinks.
 */
import {describe, expect, it} from 'vitest';
import {type ClassDeclaration, Node, Project, type SourceFile, SyntaxKind} from 'ts-morph';
import {packageRoot, ratchet, relPath, shippedSource} from './architecture-gate-support.js';

const ENGINE_PARAMETER_BASELINE: ReadonlySet<string> = new Set([
  "packages/design/domain/driver/openISDDriver.ts#OpenISDDriver.fromWdrIniText",
  "packages/design/domain/project/openISDProject.ts#OpenISDProject.builder",
  "packages/design/domain/project/openISDProject.ts#OpenISDProject.empty",
  "packages/design/domain/project/openISDProject.ts#OpenISDProject.fromWprText",
]);

/** The class names in `source` that are `cls` or extend it (transitively, within the file). */
function classFamily(source: SourceFile, cls: ClassDeclaration): Set<string> {
  const family = new Set<string>([cls.getName() ?? '']);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of source.getClasses()) {
      const name = c.getName();
      const base = c.getExtends()?.getExpression().getText();
      if (name !== undefined && base !== undefined && family.has(base) && !family.has(name)) {
        family.add(name);
        grew = true;
      }
    }
  }
  return family;
}

/** The static methods of `cls` that construct an instance of its own family — directly with
 *  `new`, or through another such static of the family. */
function constructingStatics(source: SourceFile, cls: ClassDeclaration): Set<string> {
  const family = classFamily(source, cls);
  const statics = source.getClasses()
    .filter(c => family.has(c.getName() ?? ''))
    .flatMap(c => c.getStaticMethods().map(m => ({key: `${c.getName()}.${m.getName()}`, m})));
  const exempt = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const {key, m} of statics) {
      if (exempt.has(key)) continue;
      const constructsOwn = m.getDescendantsOfKind(SyntaxKind.NewExpression)
        .some(n => family.has(n.getExpression().getText()));
      const callsOwnFactory = m.getDescendantsOfKind(SyntaxKind.CallExpression).some(call => {
        const callee = call.getExpression();
        if (!Node.isPropertyAccessExpression(callee)) return false;
        const target = callee.getExpression().getText();
        const owner = target === 'this' ? (m.getParentOrThrow() as ClassDeclaration).getName() ?? '' : target;
        return exempt.has(`${owner}.${callee.getName()}`);
      });
      if (constructsOwn || callsOwnFactory) { exempt.add(key); grew = true; }
    }
  }
  return exempt;
}

/** Every function or method with a parameter typed `Engine`, except constructors and the static
 *  factories that are constructors in effect. */
export function engineParametersIn(source: SourceFile, rel: string): string[] {
  const found: string[] = [];
  const takesEngine = (params: {getTypeNode(): {getText(): string} | undefined}[]) =>
    params.some(p => p.getTypeNode()?.getText() === 'Engine');
  for (const fn of source.getFunctions()) {
    if (takesEngine(fn.getParameters())) found.push(`${rel}#${fn.getName() ?? '<anonymous>'}`);
  }
  for (const cls of source.getClasses()) {
    const exempt = constructingStatics(source, cls);
    for (const m of cls.getMethods()) {
      const key = `${cls.getName() ?? '<anonymous>'}.${m.getName()}`;
      if (m.isStatic() && exempt.has(key)) continue;
      if (takesEngine(m.getParameters())) found.push(`${rel}#${key}`);
    }
  }
  return found;
}

describe('engine-parameter gate — it can fail (non-vacuous demonstration)', () => {
  it('flags a function and a method taking Engine; ignores a constructor and a factory that constructs its own class', () => {
    const demo = new Project({useInMemoryFileSystem: true});
    const src = demo.createSourceFile('/demo.ts', [
      'declare class Engine {}',
      'declare class Other { constructor(engine: Engine) }',
      'export function f(engine: Engine): void {}',
      'export class C {',
      '  constructor(private readonly engine: Engine) {}',
      '  static make(engine: Engine): C { return new C(engine); }',
      '  static viaSub(engine: Engine): C { return Sub.wrap(engine); }',
      '  static viaThis(engine: Engine): C { return this.make(engine); }',
      '  static other(engine: Engine): Other { return new Other(engine); }',
      '  use(engine: Engine): void {}',
      '  ok(): void {}',
      '}',
      'export class Sub extends C { static wrap(engine: Engine): Sub { return new Sub(engine); } static elsewhere(engine: Engine): Other { return new Other(engine); } }',
    ].join('\n'));
    expect(engineParametersIn(src, 'demo.ts')).toEqual(['demo.ts#f', 'demo.ts#C.other', 'demo.ts#C.use', 'demo.ts#Sub.elsewhere']);
  });
});

describe('the engine is injected, never threaded — ratchet', () => {
  it('no engine parameter outside the baseline, and every baselined one still exists', () => {
    const found: string[] = [];
    for (const source of shippedSource().getSourceFiles()) {
      const rel = relPath(source.getFilePath());
      if (rel.startsWith(relPath(packageRoot) + '/test/')) continue;
      found.push(...engineParametersIn(source, rel));
    }
    const {added, gone} = ratchet(found, ENGINE_PARAMETER_BASELINE);
    expect(added, [
      'A function taking `engine: Engine` threads the engine through every caller. Make it a',
      'method on the object that already holds the engine, or a class constructed with the one',
      'engine area it uses.',
    ].join(' ')).toEqual([]);
    expect(gone, 'These baselined sites are gone — strike them from ENGINE_PARAMETER_BASELINE.').toEqual([]);
  });
});
