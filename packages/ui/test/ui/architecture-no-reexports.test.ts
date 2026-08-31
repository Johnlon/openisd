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
 * THE ONE EXEMPTION: a package barrel entry point — any file at packages/<pkg>/src/index.ts —
 * exists solely to declare that package's public surface, and is exempt.
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

const SRC_ROOTS = readdirSync(PACKAGES)
  .map(pkg => join(PACKAGES, pkg, 'src'))
  .filter(dir => existsSync(dir) && statSync(dir).isDirectory());

/** The sanctioned barrel entry points — one per package, resolved from each package.json's
 *  OWN exports map (falling back to src/index.ts when a package declares no map). Reading
 *  the map rather than hardcoding a filename is what makes a barrel rename (D17:
 *  engine/src/index.ts → engine.ts) safe: the gate follows the package's declared entry
 *  point instead of silently exempting a file that no longer exists. */
const BARRELS = new Set(SRC_ROOTS.flatMap(root => {
  const pkgDir = dirname(root);
  try {
    const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')) as
      { exports?: Record<string, { default?: string } | string> };
    const entries = Object.values(pkg.exports ?? {})
      .map(entry => typeof entry === 'string' ? entry : entry?.default)
      .filter((rel): rel is string => Boolean(rel))
      .map(rel => join(pkgDir, rel));
    if (entries.length) return entries;
  } catch { /* no package.json or no map — fall back */ }
  return [join(root, 'index.ts')];
}));

/** Every BARRELS entry keyed by something other than the package root ('.') — e.g. model's
 *  ./driverStanding, ./driverSimulatability, ./driverConformance. The exemption above grants
 *  these the SAME re-export licence as a root barrel, unconditionally — an empty socket today
 *  (all three currently contain zero re-exports), but a dormant permission is not harmless
 *  (John's by_alias precedent: an unused grant is not a safe grant, it is a grant nobody has
 *  tested yet). Kept separate from BARRELS so the guard below can assert these specific files
 *  stay re-export-free without touching the root-barrel exemption. */
const SUBPATH_BARRELS = new Set(SRC_ROOTS.flatMap(root => {
  const pkgDir = dirname(root);
  try {
    const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')) as
      { exports?: Record<string, { default?: string } | string> };
    return Object.entries(pkg.exports ?? {})
      .filter(([key]) => key !== '.')
      .map(([, entry]) => typeof entry === 'string' ? entry : entry?.default)
      .filter((rel): rel is string => Boolean(rel))
      .map(rel => join(pkgDir, rel));
  } catch { /* no package.json or no map */ }
  return [];
}));

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

checklistDescribe('no re-exports — a name is declared where it is exported (QO80)', () => {
  it('no file outside a package barrel (packages/*/src/index.ts) re-exports anything', () => {
    const offences = SRC_ROOTS.flatMap(filesUnder)
      .filter(f => !BARRELS.has(f))
      .flatMap(reExportOffencesIn);

    assert.deepEqual(offences, [],
      'A re-export relabels a name across a module boundary and launders it past every ' +
      'import-shape gate in this suite. Consumers import a name from the module that declares ' +
      'it (or from that package\'s barrel, packages/<pkg>/src/index.ts — the one sanctioned ' +
      're-export site). Delete the re-export; migrate its consumers to the declaring module.');
  });

  it('the detector fires on a real barrel (positive control): the model root barrel is all re-exports', () => {
    // packages/model/src/index.ts re-exports its whole surface (`export ... from` lines) —
    // a live positive control proving `reExportOffencesIn` detects the shape, and pinning in
    // code WHY root barrels are excluded from the sweep above: they would all be offences.
    const modelBarrel = join(PACKAGES, 'model', 'src', 'index.ts');
    assert.ok(BARRELS.has(modelBarrel), 'precondition: the model barrel is a sanctioned barrel');
    assert.ok(reExportOffencesIn(modelBarrel).length > 0,
      'the detector must flag a file that genuinely re-exports — if this is zero the sweep above is blind');
  });

  it('a subpath barrel (e.g. model/./driverStanding) is exempt from the gate but not from scrutiny — none currently re-exports', () => {
    assert.ok(SUBPATH_BARRELS.size > 0, 'no subpath barrels found — this guard would pass vacuously');
    const offences = [...SUBPATH_BARRELS].flatMap(reExportOffencesIn);

    assert.deepEqual(offences, [],
      'A subpath barrel is exempted by the SAME rule as a root barrel (packages/*/src/index.ts) ' +
      '— but that exemption was granted for the package-entry-point shape in general, not ' +
      'reviewed per file. This file has just gained a re-export, so the exemption is now doing ' +
      'real work rather than sitting dormant: that needs a human decision (widen the exemption ' +
      'deliberately, or move this file\'s content so it no longer needs one), not a silent pass.');
  });
});
