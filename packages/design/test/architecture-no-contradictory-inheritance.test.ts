// THIS GATE EXISTS TO CATCH THE AI. THAT IS ITS WHOLE PURPOSE.
//
// John, 2026-09-22, on `DualWriteFieldImpl extends ReadonlyFieldImpl`: "use the types and names
// of those types logically". A class named `Readonly*` promises its instances cannot be written
// to. A subclass whose own name promises the opposite (`Write`/`Mutable`) — or that implements a
// write-capable interface — contradicts that promise by construction: TypeScript happily compiles
// it (inheritance here is just "borrow these getters"), but the base class's name is now a lie for
// every instance of the subclass. That contradiction is invisible to the type checker (it is a
// naming fact, not a type fact), so it needs its own gate.
//
// A red result IS the finding. Fix: stop extending the readonly-named base — extend the shared
// non-committal base instead (duplicate the couple of getters if needed; two trivial one-line
// getters are cheaper than a class hierarchy that asserts something false).
import {describe, expect, it} from 'vitest';
import {Node, Project, SyntaxKind} from 'ts-morph';
import * as path from 'node:path';
import * as url from 'node:url';

const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..', '..');

const READONLY_NAME = /Readonly/i;
const MUTABLE_NAME = /Write|Mutable/i;

interface Contradiction { file: string; line: number; text: string }

function shippedSource(): Project {
  const project = new Project({ skipAddingFilesFromTsConfig: true, skipFileDependencyResolution: true });
  project.addSourceFilesAtPaths([
    path.join(repoRoot, 'packages', '*', 'src', '**', '*.ts'),
    path.join(repoRoot, 'packages', 'design', '{domain,engine,winisd}', '**', '*.ts'),
  ]);
  return project;
}

/** Every class whose own name (or one of its `implements` interfaces) claims mutability while it
 *  `extends` a base class whose name claims the opposite. Interface names are checked too — a
 *  class can be named neutrally and still promise writes through `implements WritableField`. */
function contradictions(): Contradiction[] {
  const project = shippedSource();
  const found: Contradiction[] = [];

  for (const source of project.getSourceFiles()) {
    const file = path.relative(repoRoot, source.getFilePath());
    if (file.includes('/test/') || file.startsWith('..')) continue;

    for (const cls of source.getDescendantsOfKind(SyntaxKind.ClassDeclaration)) {
      const heritage = cls.getHeritageClauses();
      const extendsClause = heritage.find((h) => h.getToken() === SyntaxKind.ExtendsKeyword);
      const base = extendsClause?.getTypeNodes()[0]?.getExpression().getText();
      if (!base || !READONLY_NAME.test(base)) continue;

      const implementsClause = heritage.find((h) => h.getToken() === SyntaxKind.ImplementsKeyword);
      const implementedNames = implementsClause?.getTypeNodes().map((t) => t.getExpression().getText()) ?? [];
      const className = cls.getName() ?? '<anonymous>';
      const claimsMutable = MUTABLE_NAME.test(className) || implementedNames.some((n) => MUTABLE_NAME.test(n));
      if (!claimsMutable) continue;

      found.push({
        file,
        line: cls.getStartLineNumber(),
        text: `class ${className} extends ${base} implements ${implementedNames.join(', ')}`,
      });
    }
  }
  return found;
}

describe('no contradictory inheritance — a class name and its base class name must agree on mutability', () => {
  it('can actually see the source it is meant to guard', () => {
    const project = shippedSource();
    const files = project.getSourceFiles()
      .map((s) => path.relative(repoRoot, s.getFilePath()))
      .filter((f) => !f.includes('/test/') && !f.startsWith('..'));
    expect(files.length).toBeGreaterThan(40);
    expect(files).toContain('packages/design/domain/cell.ts');
  });

  it('finds no writable-named class extending a readonly-named base', () => {
    expect(contradictions().map((c) => `${c.file}:${c.line}  ${c.text}`)).toEqual([]);
  });
});

// John, 2026-09-22: "likewise a nullable and nonnullable are exclusive" — `Nullable<T>` (the
// value can be absent) and `NonNull<T>` (the schema guarantees it present) state opposite facts
// about the SAME field. One declaration extending/implementing both would be claiming a value is
// simultaneously "may be absent" and "guaranteed present" — a contradiction no compiler check
// catches, because structurally the two interfaces don't overlap in members and TypeScript is
// happy to intersect them.
const EXCLUSIVE_NAME_PAIRS: readonly (readonly [RegExp, RegExp])[] = [
  [/\bNullable\b/, /\bNonNull\b/],
];

/** Every interface or class whose own name plus everything it `extends`/`implements` names BOTH
 *  sides of one of `EXCLUSIVE_NAME_PAIRS` at once. */
function exclusivityViolations(): Contradiction[] {
  const project = shippedSource();
  const found: Contradiction[] = [];

  for (const source of project.getSourceFiles()) {
    const file = path.relative(repoRoot, source.getFilePath());
    if (file.includes('/test/') || file.startsWith('..')) continue;

    const declarations = [
      ...source.getDescendantsOfKind(SyntaxKind.InterfaceDeclaration),
      ...source.getDescendantsOfKind(SyntaxKind.ClassDeclaration),
    ];

    for (const decl of declarations) {
      const ownName = decl.getName() ?? '<anonymous>';
      const heritageNames = decl.getHeritageClauses()
        .flatMap((h) => h.getTypeNodes())
        .map((t) => t.getExpression().getText());
      const names = [ownName, ...heritageNames];

      for (const [a, b] of EXCLUSIVE_NAME_PAIRS) {
        if (names.some((n) => a.test(n)) && names.some((n) => b.test(n))) {
          found.push({ file, line: decl.getStartLineNumber(), text: `${ownName} names both ${a} and ${b}: [${names.join(', ')}]` });
        }
      }
    }
  }
  return found;
}

describe('no exclusive-concept co-occurrence — Nullable and NonNull never name the same declaration', () => {
  it('the detector actually catches a contradiction (sanity check on synthetic source)', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile(path.join(repoRoot, 'packages', 'design', 'domain', '__synthetic__.ts'), `
      interface Nullable<T> { value: T | null; }
      interface NonNull<T> { value: T; }
      interface Broken<T> extends Nullable<T>, NonNull<T> {}
    `);
    const heritageNames = file.getDescendantsOfKind(SyntaxKind.InterfaceDeclaration)
      .find((i) => i.getName() === 'Broken')!
      .getHeritageClauses().flatMap((h) => h.getTypeNodes()).map((t) => t.getExpression().getText());
    expect(EXCLUSIVE_NAME_PAIRS.some(([a, b]) =>
      heritageNames.some((n) => a.test(n)) && heritageNames.some((n) => b.test(n)))).toBe(true);
  });

  it('finds no declaration naming both Nullable and NonNull in shipped source', () => {
    expect(exclusivityViolations().map((c) => `${c.file}:${c.line}  ${c.text}`)).toEqual([]);
  });
});

// Combination rules for the capability atoms in cell.ts (`Readable`, `Entered`, `Calculated`,
// `Writable`, `Clearable`, `Calculatable`, `Unsolvable`). A field's type is an `&` intersection
// of these written out at its declaration site — not a named interface — so this walk looks at
// every `IntersectionType` type node that names `Readable`, not at class/interface heritage.
const REQUIRED_NAME_PAIRS: readonly (readonly [RegExp, RegExp])[] = [
  [/\bWritable\b/, /\bEntered\b/],       // Writable: a person can put a value there — Entered says whether they did.
  [/\bCalculatable\b/, /\bCalculated\b/], // Calculatable: the solver can write — Calculated says whether it did.
];

interface FieldTypeSite { file: string; line: number; name: string; names: readonly string[]; readableArg: string | null }

function nameOfNode(n: Node): string | undefined {
  if (Node.isPropertySignature(n)) return n.getName();
  if (Node.isPropertyDeclaration(n)) return n.getName();
  if (Node.isGetAccessorDeclaration(n)) return n.getName();
  if (Node.isMethodSignature(n)) return n.getName();
  if (Node.isMethodDeclaration(n)) return n.getName();
  if (Node.isFunctionDeclaration(n)) return n.getName();
  if (Node.isParameterDeclaration(n)) return n.getName();
  if (Node.isVariableDeclaration(n)) return n.getName();
  return undefined;
}

/** The nearest named ancestor of a type node — the property, getter, function, parameter or
 *  variable the intersection type is declared on — for a readable finding label. */
function siteName(node: Node): string {
  const named = node.getAncestors().find((a) => nameOfNode(a) !== undefined);
  return (named && nameOfNode(named)) || '<anonymous>';
}

function typeReferenceName(n: Node): string | null {
  return Node.isTypeReference(n) ? n.getTypeName().getText() : null;
}

/** Every `IntersectionType` type node in shipped source that names `Readable` — one entry per
 *  field-shaped declaration site, wherever it appears (property, getter, function/method return
 *  type, parameter). */
function fieldTypeSites(): FieldTypeSite[] {
  const project = shippedSource();
  const sites: FieldTypeSite[] = [];

  for (const source of project.getSourceFiles()) {
    const file = path.relative(repoRoot, source.getFilePath());
    if (file.includes('/test/') || file.startsWith('..')) continue;

    for (const inter of source.getDescendantsOfKind(SyntaxKind.IntersectionType)) {
      const members = inter.getTypeNodes();
      const readableRef = members.find((m) => typeReferenceName(m) === 'Readable');
      if (!readableRef || !Node.isTypeReference(readableRef)) continue;

      const names = members.map((m) => typeReferenceName(m) ?? m.getText());
      const readableArg = readableRef.getTypeArguments()[0]?.getText() ?? null;
      sites.push({ file, line: inter.getStartLineNumber(), name: siteName(inter), names, readableArg });
    }
  }
  return sites;
}

/** `null` is the one spelling of absence (2026-09-23 ruling, superseding an earlier `NotAvailable`
 *  sentinel design) — a field's `Readable<...>` type argument carries `null` exactly when the
 *  field can be absent. */
function readsAsNullable(readableArg: string | null): boolean {
  return readableArg !== null && /\bnull\b/.test(readableArg);
}

/** Every field-shaped declaration site whose atoms contradict the combination rules: `Writable`
 *  without `Entered`, `Calculatable` without `Calculated`, `Clearable` over a non-null `Readable`
 *  without `Calculated` (a clear with nowhere to empty to must land a derived default), or
 *  `Unsolvable` over a `Readable` that cannot read `null` (the solver's "could not derive this"
 *  has nowhere to land). */
function combinationViolations(): Contradiction[] {
  const found: Contradiction[] = [];

  for (const site of fieldTypeSites()) {
    for (const [has, needs] of REQUIRED_NAME_PAIRS) {
      const hasIt = site.names.some((n) => has.test(n));
      const needsIt = site.names.some((n) => needs.test(n));
      if (!hasIt || needsIt) continue;
      found.push({ file: site.file, line: site.line, text: `${site.name}: has ${has.source} without ${needs.source} — [${site.names.join(', ')}]` });
    }

    const hasClearable = site.names.some((n) => /\bClearable\b/.test(n));
    const hasCalculated = site.names.some((n) => /\bCalculated\b/.test(n));
    const hasUnsolvable = site.names.some((n) => /\bUnsolvable\b/.test(n));
    const nullable = readsAsNullable(site.readableArg);

    if (hasClearable && !nullable && !hasCalculated) {
      found.push({ file: site.file, line: site.line, text: `${site.name}: Clearable over a non-null Readable requires Calculated — [${site.names.join(', ')}]` });
    }
    if (hasUnsolvable && !nullable) {
      found.push({ file: site.file, line: site.line, text: `${site.name}: Unsolvable requires a Readable<... | null> — [${site.names.join(', ')}]` });
    }
  }
  return found;
}

describe('field type combinations — the capability atoms combine consistently wherever a field type is declared', () => {
  it('the detector actually catches a contradiction (sanity check on synthetic source)', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile(path.join(repoRoot, 'packages', 'design', 'domain', '__synthetic_combo__.ts'), `
      function bad(): Readable<number> & Writable<number> { throw new Error('unreachable'); }
    `);
    const inter = file.getFirstDescendantByKindOrThrow(SyntaxKind.IntersectionType);
    const names = inter.getTypeNodes().map((m) => typeReferenceName(m) ?? m.getText());
    expect(names.some((n) => /\bWritable\b/.test(n)) && !names.some((n) => /\bEntered\b/.test(n))).toBe(true);
  });

  it('finds no combination violation in shipped source', () => {
    expect(combinationViolations().map((c) => `${c.file}:${c.line}  ${c.text}`)).toEqual([]);
  });
});
