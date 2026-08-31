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
 * An import must name the module that DECLARES the symbol, never a module that re-exports it
 * (A9, complement to `architecture-no-reexports.test.ts`). The re-export ban removes the
 * supply; this removes the demand, so a re-export reintroduced anywhere has no consumer to
 * hide behind and both gates fail together instead of one covering for the other.
 *
 * The check is a resolution comparison, run through the type system, never a text match — a
 * comment or docstring naming a re-export cannot trip it:
 *
 *   1. resolve each import declaration's module specifier to its source file;
 *   2. ask that file for its exported declarations;
 *   3. require the declaration for the imported name to live IN that file.
 *
 * A name whose declaration resolves to a different file means the specifier points at an
 * intermediary, which is the offence. This subsumes every re-export spelling — `export {} from`,
 * `export *`, `export type {} from`, and the hand-rolled import/export pair — because all of
 * them leave the declaration in the original file.
 *
 * THE ONE EXEMPTION: a package entry point, taken from that package's own `package.json`
 * exports map. Every subpath the map declares is an entry point, not just `.` — `@openisd/model`
 * publishes `./driverStanding`, `./driverSimulatability` and `./driverConformance` alongside its
 * root, and each is as sanctioned a specifier as the root barrel. Reading the map rather than
 * hardcoding filenames keeps the gate correct across an entry-point rename.
 *
 * Out of scope by construction: specifiers resolving outside `packages/<pkg>/src` (node_modules,
 * `vue`, node builtins) — this gate governs first-party module boundaries only.
 */
import { describe, it, vi } from 'vitest';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { Project as TsProject, type SourceFile } from 'ts-morph';

vi.setConfig({ testTimeout: 120_000 });

const UI_PKG = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PACKAGES = join(UI_PKG, '..');
const REPO_ROOT = join(PACKAGES, '..');

const SRC_ROOTS = readdirSync(PACKAGES)
  .map(pkg => join(PACKAGES, pkg, 'src'))
  .filter(dir => existsSync(dir) && statSync(dir).isDirectory());

/** Every entry point each package declares, across ALL subpaths of its exports map. A package
 *  with no map falls back to `src/index.ts`. These are the only specifiers permitted to serve a
 *  name they do not declare. */
function entryPointsOf(srcRoot: string): string[] {
  const pkgDir = dirname(srcRoot);
  try {
    const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')) as
      { exports?: Record<string, { types?: string; default?: string } | string> };
    const map = pkg.exports;
    if (map) {
      const out: string[] = [];
      for (const entry of Object.values(map)) {
        const rel = typeof entry === 'string' ? entry : (entry?.default ?? entry?.types);
        if (rel) out.push(join(pkgDir, rel));
      }
      if (out.length) return out;
    }
  } catch { /* no package.json, or unparseable — fall back */ }
  return [join(srcRoot, 'index.ts')];
}

const ENTRY_POINTS = new Set(SRC_ROOTS.flatMap(entryPointsOf));

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  (function walk(current: string) {
    for (const name of readdirSync(current)) {
      const full = join(current, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.ts') || name.endsWith('.vue')) out.push(full);
    }
  })(dir);
  return out;
}

const project = new TsProject({
  tsConfigFilePath: join(UI_PKG, 'tsconfig.json'),
  skipAddingFilesFromTsConfig: true,
});

/** A `.vue` file's `<script>` block parsed as a virtual TS source file; a `.ts` file as-is. */
function sourceFileOf(file: string): SourceFile {
  const raw = readFileSync(file, 'utf8');
  const isVue = file.endsWith('.vue');
  const text = isVue ? (/<script[^>]*>([\s\S]*?)<\/script>/.exec(raw)?.[1] ?? '') : raw;
  return project.createSourceFile(isVue ? `${file}.ts` : file, text, { overwrite: true });
}

/** True for a file this gate governs: first-party source under some `packages/<pkg>/src`. */
function isFirstPartySource(path: string): boolean {
  return SRC_ROOTS.some(root => path.startsWith(root + '/'));
}

/**
 * The detector, pure over a source file so the demonstration below can drive it with synthetic
 * input. Returns one string per offence.
 */
export function importsFromNonDeclarer(
  source: SourceFile,
  isGoverned: (path: string) => boolean,
  isEntryPoint: (path: string) => boolean,
  describePath: (path: string) => string,
): string[] {
  const offences: string[] = [];

  for (const imp of source.getImportDeclarations()) {
    const target = imp.getModuleSpecifierSourceFile();
    if (!target) continue;
    const targetPath = target.getFilePath();
    if (!isGoverned(targetPath) || isEntryPoint(targetPath)) continue;

    const exported = target.getExportedDeclarations();
    const line = imp.getStartLineNumber();

    const wanted: string[] = imp.getNamedImports().map(ni => ni.getNameNode().getText());
    if (imp.getDefaultImport()) wanted.push('default');

    for (const name of wanted) {
      const declarations = exported.get(name);
      if (!declarations || declarations.length === 0) continue;
      const elsewhere = declarations
        .map(d => d.getSourceFile().getFilePath())
        .filter(p => p !== targetPath);
      if (elsewhere.length > 0) {
        offences.push(
          `${describePath(source.getFilePath())}:${line} imports '${name}' from ` +
          `'${imp.getModuleSpecifierValue()}', which re-exports it — declared in ` +
          `${[...new Set(elsewhere)].map(describePath).join(', ')}`);
      }
    }
  }

  return offences;
}

describe('an import names the module that declares the symbol (A9)', () => {
  it('flags an import served by a re-exporter', () => {
    const demo = new TsProject({ useInMemoryFileSystem: true });
    demo.createSourceFile('/src/declarer.ts', 'export class Thing { n = 1; }');
    demo.createSourceFile('/src/relay.ts', "export { Thing } from './declarer.js';");
    const consumer = demo.createSourceFile('/src/consumer.ts',
      "import { Thing } from './relay.js';\nexport const t = new Thing();");

    const offences = importsFromNonDeclarer(consumer, () => true, () => false, p => p);

    assert.equal(offences.length, 1, 'the relay import must be flagged');
    assert.match(offences[0]!, /imports 'Thing' from '\.\/relay\.js', which re-exports it/);
    assert.match(offences[0]!, /declared in \/src\/declarer\.ts/);
  });

  it('accepts an import taken straight from the declaring module', () => {
    const demo = new TsProject({ useInMemoryFileSystem: true });
    demo.createSourceFile('/src/declarer.ts', 'export class Thing { n = 1; }');
    const consumer = demo.createSourceFile('/src/consumer.ts',
      "import { Thing } from './declarer.js';\nexport const t = new Thing();");

    assert.deepEqual(importsFromNonDeclarer(consumer, () => true, () => false, p => p), []);
  });

  it('accepts an import from a sanctioned package entry point', () => {
    const demo = new TsProject({ useInMemoryFileSystem: true });
    demo.createSourceFile('/src/declarer.ts', 'export class Thing { n = 1; }');
    demo.createSourceFile('/src/index.ts', "export { Thing } from './declarer.js';");
    const consumer = demo.createSourceFile('/src/consumer.ts',
      "import { Thing } from './index.js';\nexport const t = new Thing();");

    const offences = importsFromNonDeclarer(
      consumer, () => true, p => p === '/src/index.ts', p => p);

    assert.deepEqual(offences, []);
  });

  it('every first-party import in the tree resolves to its declaring module', () => {
    const offences: string[] = [];
    for (const f of SRC_ROOTS.flatMap(filesUnder)) {
      offences.push(...importsFromNonDeclarer(
        sourceFileOf(f),
        isFirstPartySource,
        p => ENTRY_POINTS.has(p),
        p => relative(REPO_ROOT, p),
      ));
    }

    assert.deepEqual(offences, [],
      'An import routed through a re-exporter hides which module owns the symbol, and hides ' +
      'the re-export itself from every import-shape gate in this suite. Point the specifier at ' +
      'the module that declares the name, or at the package entry point its exports map ' +
      'publishes.');
  });
});
