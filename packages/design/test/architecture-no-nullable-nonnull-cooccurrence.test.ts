import {describe, expect, it} from 'vitest';
import {Project, SyntaxKind} from 'ts-morph';
import * as path from 'node:path';
import * as url from 'node:url';

const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..', '..');

interface Contradiction { file: string; line: number; text: string }

function shippedSource(): Project {
  const project = new Project({ skipAddingFilesFromTsConfig: true, skipFileDependencyResolution: true });
  project.addSourceFilesAtPaths([
    path.join(repoRoot, 'packages', '*', 'src', '**', '*.ts'),
    path.join(repoRoot, 'packages', 'design', '{domain,engine,winisd}', '**', '*.ts'),
  ]);
  return project;
}

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
