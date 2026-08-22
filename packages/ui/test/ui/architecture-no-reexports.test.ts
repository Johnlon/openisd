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
const BARRELS = new Set(SRC_ROOTS.map(root => {
  const pkgDir = dirname(root);
  try {
    const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')) as
      { exports?: Record<string, { default?: string } | string> };
    const entry = pkg.exports?.['.'];
    const rel = typeof entry === 'string' ? entry : entry?.default;
    if (rel) return join(pkgDir, rel);
  } catch { /* no package.json or no map — fall back */ }
  return join(root, 'index.ts');
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

checklistDescribe('no re-exports — a name is declared where it is exported (QO80)', () => {
  it('no file outside a package barrel (packages/*/src/index.ts) re-exports anything', () => {
    const offences: string[] = [];

    for (const f of SRC_ROOTS.flatMap(filesUnder)) {
      if (BARRELS.has(f)) continue;
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
    }

    assert.deepEqual(offences, [],
      'A re-export relabels a name across a module boundary and launders it past every ' +
      'import-shape gate in this suite. Consumers import a name from the module that declares ' +
      'it (or from that package\'s barrel, packages/<pkg>/src/index.ts — the one sanctioned ' +
      're-export site). Delete the re-export; migrate its consumers to the declaring module.');
  });
});
