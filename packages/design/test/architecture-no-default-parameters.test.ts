// THIS GATE EXISTS TO CATCH THE AI. THAT IS ITS WHOLE PURPOSE.
//
// A red result IS the finding. Permitted responses: name the defect and repair it, or STOP and
// report. Raising the ceiling, excluding a file or renaming so the matcher stops firing is making
// the red go away instead of making the code right. After ANY edit to this file, break what it
// guards and watch it fail. See AGENTS.md "Every architecture test exists to catch the AI".

/**
 * NO DEFAULT PARAMETER VALUES. John, 10 Nov 2026: "default values are an antipattern". A default
 * lets a caller forget an argument and the compiler stays quiet (T744: a default on
 * OpenISDDriverStandalone.wrap gave the driver editor's copy no project). Every caller passes
 * every argument.
 *
 * A CEILING that only goes down: the count of parameters with an initializer (functions,
 * methods, constructors, arrow functions) in shipped source. Above the ceiling fails; below it
 * fails too, asking for the ceiling to be lowered. Target 0 (task T750).
 */
import {describe, expect, it} from 'vitest';
import {Project, SyntaxKind} from 'ts-morph';
import {execFileSync} from 'node:child_process';
import * as path from 'node:path';
import * as url from 'node:url';

const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..', '..');

const DEFAULT_PARAMETER_CEILING = 70;

/** `file:line` of every parameter with an initializer in the given source text. */
function defaultsIn(fileName: string, text: string): string[] {
  const project = new Project({useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true});
  const source = project.createSourceFile(fileName, text);
  return source
    .getDescendantsOfKind(SyntaxKind.Parameter)
    .filter(p => p.hasInitializer())
    .map(p => `${fileName}:${p.getStartLineNumber()}`);
}

function isShippedSource(file: string): boolean {
  if (!file.endsWith('.ts') || file.endsWith('.d.ts')) return false;
  if (file.endsWith('.test.ts') || file.endsWith('.spec.ts')) return false;
  if (file.split('/').includes('test')) return false;
  const parts = file.split('/');
  if (parts[0] !== 'packages') return false;
  return parts[1] === 'design' || parts[1] === 'persistence' || parts[2] === 'src';
}

function shippedDefaults(): string[] {
  const tracked = execFileSync('git', ['ls-files', 'packages'], {cwd: repoRoot, encoding: 'utf8'})
    .split('\n')
    .filter(isShippedSource);
  const project = new Project({skipAddingFilesFromTsConfig: true, skipFileDependencyResolution: true});
  const found: string[] = [];
  for (const file of tracked) {
    let source;
    try {
      source = project.addSourceFileAtPath(path.join(repoRoot, file));
    } catch {
      continue; // tracked but removed from disk in this tree
    }
    for (const p of source.getDescendantsOfKind(SyntaxKind.Parameter)) {
      if (p.hasInitializer()) found.push(`${file}:${p.getStartLineNumber()}`);
    }
  }
  return found;
}

describe('no default parameter values', () => {
  it('counts a default on a function, method, constructor and arrow function', () => {
    const text = [
      'function f(a = 1) {}',
      'class C { constructor(b = 2) {} m(c = 3) {} }',
      'const g = (d = 4) => d;',
      'function none(e: number) {}',
    ].join('\n');
    expect(defaultsIn('x.ts', text)).toEqual(['x.ts:1', 'x.ts:2', 'x.ts:2', 'x.ts:3']);
  });

  it('shipped source has exactly the ceiling of default parameters', () => {
    const found = shippedDefaults();
    const list = found.join('\n');
    expect(
      found.length,
      `A default parameter was added (${found.length} > ${DEFAULT_PARAMETER_CEILING}). Remove it; the caller passes the argument. All defaults:\n${list}`,
    ).toBeLessThanOrEqual(DEFAULT_PARAMETER_CEILING);
    expect(
      found.length,
      `Defaults were removed (${found.length} < ${DEFAULT_PARAMETER_CEILING}). Lower DEFAULT_PARAMETER_CEILING to ${found.length}. Remaining:\n${list}`,
    ).toBeGreaterThanOrEqual(DEFAULT_PARAMETER_CEILING);
  });
});
