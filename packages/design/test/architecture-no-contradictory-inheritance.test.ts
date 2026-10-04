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
import {Project, SyntaxKind} from 'ts-morph';
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
