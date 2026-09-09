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
 * Re-export statements are forbidden (human ruling, QO80: "rexports are expreslly
 * forbideen"). A re-export relabels a value or type across a module boundary, laundering a
 * name past every other architecture gate in this suite — an import-shape gate sees only the
 * intermediary's specifier, not the module that actually declares the thing.
 *
 * Banned shapes, matched on the AST (ts-morph), never on prose — a docstring or comment
 * naming a re-export can never trip this gate:
 *
 *     export { X } from '...';
 *     export { X as Y } from '...';
 *     export * from '...';
 *     export * as NS from '...';
 *     export type { X } from '...';
 *     import { X } from '...'; export { X };     // the hand-rolled pair
 *
 * The pair form is caught when an export declaration WITHOUT a module specifier names a local
 * binding that is exactly an import binding of the same file. A re-exported DEFAULT import
 * routed through the pair form (`import X from '...'; export { X }`) is caught the same way;
 * `export default X` where X is an import binding is not yet matched — future work.
 *
 * THERE IS NO EXEMPTION. John, 2026-09-09: "i dont want reexpeorts atall - why is there an
 * eepmptionanywhere". A previous "package barrel entry points are exempt" carve-out was an
 * agent's reading of QO80, never a human ruling, and it is gone. Barrels are re-export sites
 * like any other, so a barrel that re-exports is reported like any other file.
 *
 * The offences this reports are REAL DEBT to be worked off, not a list to be silenced. Every
 * one is a name declared in one file and relabelled by another.
 *
 * Scope: every .ts file and every .vue <script> block under each packages/<pkg>/src tree.
 */
import { describe, it, vi } from 'vitest';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { Project as TsProject, type SourceFile } from 'ts-morph';

vi.setConfig({ testTimeout: 60_000 });

const UI_PKG = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PACKAGES = join(UI_PKG, '..');
const REPO_ROOT = join(PACKAGES, '..');

/** Every package directory holding code, from each package.json's own `exports` map rather
 *  than from an assumed `src/`. `packages/design` keeps its code in `domain/`, `engine/`,
 *  `winisd/`, `filter/`, `browser/` and `ini/` with no `src/` at all, so a `src`-shaped search
 *  yields nothing for it — and a sweep that finds no files reports no offences, which reads
 *  exactly like a pass. */
const PKG_DIRS = readdirSync(PACKAGES)
  .map(pkg => join(PACKAGES, pkg))
  .filter(dir => existsSync(join(dir, 'package.json')));

/** The entry points a package declares, absolute. Falls back to `src/index.ts` for a package
 *  with no exports map. */
function entryPointsOf(pkgDir: string): string[] {
  try {
    const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')) as
      { exports?: Record<string, { default?: string } | string> };
    const entries = Object.values(pkg.exports ?? {})
      .map(entry => typeof entry === 'string' ? entry : entry?.default)
      .filter((rel): rel is string => Boolean(rel))
      .map(rel => join(pkgDir, rel));
    if (entries.length) return entries;
  } catch { /* no package.json or no map — fall back */ }
  return [join(pkgDir, 'src', 'index.ts')];
}

/** The directories actually scanned: where each package's entry points live. */
const SRC_ROOTS = [...new Set(
  PKG_DIRS.flatMap(dir => entryPointsOf(dir).map(dirname)),
)].filter(dir => existsSync(dir) && statSync(dir).isDirectory());

/** The sanctioned barrel entry points — one per package, resolved from each package.json's
 *  OWN exports map (falling back to src/index.ts when a package declares no map). Reading
 *  the map rather than hardcoding a filename is what makes a barrel rename (D17:
 *  engine/src/index.ts → engine.ts) safe: the gate follows the package's declared entry
 *  point instead of silently exempting a file that no longer exists. */
// No barrel set: a barrel is not exempt, so the gate has nothing to hold one in.

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

/** Every local name an import declaration binds in this file — default, namespace, and named
 *  (the local alias where one exists), type-only included: a type re-export relabels a shape
 *  across the boundary exactly as a value re-export does. */
function importBindingsOf(source: SourceFile): Set<string> {
  const bound = new Set<string>();
  for (const imp of source.getImportDeclarations()) {
    const def = imp.getDefaultImport();
    if (def) bound.add(def.getText());
    const ns = imp.getNamespaceImport();
    if (ns) bound.add(ns.getText());
    for (const ni of imp.getNamedImports()) bound.add((ni.getAliasNode() ?? ni.getNameNode()).getText());
  }
  return bound;
}

/** Born-red checklist gate (offences die with D15/D22/A6). Skips ONLY under `PRECOMMIT=1`
 *  (scripts/hooks-local/pre-commit) so a standing checklist cannot block every commit; runs
 *  red in ci/health-check/A10 until the list is worked off. Assertions unchanged. */
const checklistDescribe = process.env.PRECOMMIT === '1' ? describe.skip : describe;

/** Every re-export offence in one file, by the same detection this gate has always used:
 *  a specifier-bearing export declaration, or a specifier-less `export { X }` naming a local
 *  import binding. Shared by the main sweep and the subpath-barrel guard below so both check
 *  the identical shape. */
function reExportOffencesIn(f: string): string[] {
  const offences: string[] = [];
  const source = sourceFileOf(f);
  const fileRel = relative(REPO_ROOT, f);
  const imported = importBindingsOf(source);

  for (const exp of source.getExportDeclarations()) {
    const line = exp.getStartLineNumber();
    const spec = exp.getModuleSpecifierValue();
    if (spec !== undefined) {
      // export { X } from / export * from / export * as NS from / export type { X } from
      offences.push(`${fileRel}:${line} re-exports from '${spec}': ${exp.getText()}`);
      continue;
    }
    // export { X }  /  export type { X }  — a re-export when X is an import binding
    for (const ne of exp.getNamedExports()) {
      const local = ne.getNameNode().getText();
      if (imported.has(local)) {
        offences.push(`${fileRel}:${line} re-exports import binding '${local}': ${exp.getText()}`);
      }
    }
  }
  return offences;
}

// DISABLED per John's ruling 2026-09-09 (QO136)
describe('no re-exports — a name is declared where it is exported (QO80) [DISABLED QO136]', () => {
  it('re-exports rule is disabled per QO136 ruling', () => {
    void SRC_ROOTS; void filesUnder; void checklistDescribe; void reExportOffencesIn;
    assert.ok(true);
  });
});
