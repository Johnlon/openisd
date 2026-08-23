/**
 * `docs/design/PERSISTENCE_NAMING_AND_PLACEMENT.md` §Enforcement — the persistence vocabulary
 * gate. Three concepts, three words, three homes: STORAGE (`persistence/storage/`, a dumb
 * port onto bytes), REPO (`persistence/repos/`, domain-shaped access to one collection), STATE
 * (`logic/*State.ts`, the app's reactive truth). The word "store" is eliminated from the
 * codebase entirely (orchestrator ruling, 2026-08-22, pending John's review) — the port is
 * STORAGE, the app state is `appState`, and nothing is called a store.
 *
 * Shape-based checks over the AST, never prose greps — a docstring explaining the rule must not
 * fail the rule (behavioral_instructions.md §"BAN THE CODE, NEVER THE VOCABULARY"). This file
 * is born GREEN: it exists to guard the D20 rename from rotting back, not to record a checklist.
 */
import { describe, it, vi } from 'vitest';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { Project as TsProject, Node, SyntaxKind, type SourceFile } from 'ts-morph';

// AST-walking over the whole tree is parse-bound work, not the function-call unit tests
// vitest's 5s default budget is calibrated for (same reasoning as architecture.test.ts).
// Measured clean-run total: ~16-20s (CHECK 4's first case alone ~12s — it scans topLevelExportedNames
// over the ENTIRE ui/src + persistence/src tree, the widest scope of any check here; parsing is
// already cached via sfCache below, so this is genuine full-tree AST-getter traversal cost, not
// a parse gap). Reported once under full-suite load as a 37s-vs-60s near-timeout, though not
// actually red (passed standalone) — widened to 120s so CPU contention during a full-suite run
// can't turn the slowest gate here into a fake timeout that looks nothing like a genuine offence list.
vi.setConfig({ testTimeout: 120_000 });

const UI_SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');
// persistence/repos and persistence/storage live in their own package now (@openisd/persistence,
// moved out of ui/src by John's ruling that the data-access tier is a real package boundary,
// not a directory convention) — this gate's checks still apply to it, just at its new home.
const PERSISTENCE_SRC = join(UI_SRC, '..', '..', 'persistence', 'src');
const STORAGE_DIR = join(PERSISTENCE_SRC, 'storage');
const REPOS_DIR = join(PERSISTENCE_SRC, 'repos');
const PERSISTENCE_DIR = PERSISTENCE_SRC;

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
  tsConfigFilePath: join(UI_SRC, '..', 'tsconfig.json'),
  skipAddingFilesFromTsConfig: true,
});

const sfCache = new Map<string, SourceFile>();
function sourceFileOf(file: string): SourceFile {
  const cached = sfCache.get(file);
  if (cached) return cached;
  const raw = readFileSync(file, 'utf8');
  const isVue = file.endsWith('.vue');
  const text = isVue ? (/<script[^>]*>([\s\S]*?)<\/script>/.exec(raw)?.[1] ?? '') : raw;
  const virtualPath = isVue ? `${file}.ts` : file;
  const created = project.createSourceFile(virtualPath, text, { overwrite: true });
  sfCache.set(file, created);
  return created;
}

const rel = (f: string) => relative(UI_SRC, f);

/** Every module specifier a VALUE import pulls in — `import type` erases at compile time and
 *  creates no runtime edge, so it is exempt (same reasoning as architecture.test.ts). */
function valueImportSpecs(file: string): string[] {
  const source = sourceFileOf(file);
  const out: string[] = [];
  for (const imp of source.getImportDeclarations()) {
    if (imp.isTypeOnly()) continue;
    const clause = imp.getImportClause();
    if (!clause) { out.push(imp.getModuleSpecifierValue()); continue; }
    const namedBindings = clause.getNamedBindings();
    const hasDefaultOrNamespace = !!clause.getDefaultImport() || namedBindings?.getKind() === SyntaxKind.NamespaceImport;
    const namedImports = namedBindings?.asKind(SyntaxKind.NamedImports)?.getElements() ?? [];
    const hasValueNamed = namedImports.some(ni => !ni.isTypeOnly());
    if (hasDefaultOrNamespace || hasValueNamed) out.push(imp.getModuleSpecifierValue());
  }
  return out;
}

/** Every top-level exported name (function, class, const/let/var, interface, type alias). */
function topLevelExportedNames(file: string): string[] {
  const source = sourceFileOf(file);
  const names: string[] = [];
  for (const fn of source.getFunctions()) { const n = fn.getName(); if (fn.isExported() && n) names.push(n); }
  for (const cls of source.getClasses()) { const n = cls.getName(); if (cls.isExported() && n) names.push(n); }
  for (const iface of source.getInterfaces()) if (iface.isExported()) names.push(iface.getName());
  for (const ta of source.getTypeAliases()) if (ta.isExported()) names.push(ta.getName());
  for (const vs of source.getVariableStatements()) {
    if (!vs.isExported()) continue;
    for (const decl of vs.getDeclarations()) names.push(decl.getName());
  }
  return names;
}

describe('persistence vocabulary — CHECK 1: stores/ names no domain concept', () => {
  it('no file under persistence/storage/ imports a domain type or a repo', () => {
    const files = filesUnder(STORAGE_DIR);
    assert.ok(files.length > 0, 'no files found under persistence/storage/ — the gate would pass vacuously');
    const offences: string[] = [];
    for (const f of files) {
      for (const spec of valueImportSpecs(f)) {
        if (spec.startsWith('@openisd/')) offences.push(`${rel(f)} imports domain package ${spec}`);
        if (/(^|\/)repos\//.test(spec)) offences.push(`${rel(f)} imports a repo (${spec}) — a port knows no collection`);
      }
    }
    assert.deepEqual(offences, [],
      'A STORAGE port moves opaque bytes/strings and nothing else — it must not know what a ' +
      'driver, a preference, or any domain shape is. Move the domain-aware code to a repo.');
  });
});

describe('persistence vocabulary — CHECK 2: repos/ never touches a browser API directly', () => {
  it('no file under persistence/repos/ names window, document, or localStorage', () => {
    const files = filesUnder(REPOS_DIR);
    assert.ok(files.length > 0, 'no files found under persistence/repos/ — the gate would pass vacuously');
    const BROWSER_GLOBALS = new Set(['window', 'document', 'localStorage', 'sessionStorage', 'indexedDB']);
    const offences: string[] = [];
    for (const f of files) {
      const source = sourceFileOf(f);
      source.forEachDescendant(node => {
        if (!Node.isIdentifier(node)) return;
        if (!BROWSER_GLOBALS.has(node.getText())) return;
        // Only a genuine reference (not a property name / import specifier text) counts.
        const parent = node.getParent();
        if (parent && Node.isPropertyAccessExpression(parent) && parent.getNameNode() === node) return;
        offences.push(`${rel(f)} names ${node.getText()} directly`);
      });
    }
    assert.deepEqual(offences, [],
      'A REPO takes its storage by injection (`KeyValueStorage`) — it never reaches for a ' +
      'browser API itself, or it stops being substitutable by an in-memory twin in a test.');
  });
});

describe('persistence vocabulary — CHECK 3: *Storage lives only under storage/, *Repo only under repos/', () => {
  it('no exported symbol matching /Storage$/ lives under persistence/repos/', () => {
    const offences: string[] = [];
    for (const f of filesUnder(REPOS_DIR)) {
      for (const name of topLevelExportedNames(f)) {
        if (/Storage$/.test(name)) offences.push(`${rel(f)} exports ${name}`);
      }
    }
    assert.deepEqual(offences, [], 'A *Storage-named export under repos/ is a port living in a REPO file.');
  });

  it('no exported symbol matching /Repo$/ lives under persistence/storage/', () => {
    const offences: string[] = [];
    for (const f of filesUnder(STORAGE_DIR)) {
      for (const name of topLevelExportedNames(f)) {
        if (/Repo$/.test(name)) offences.push(`${rel(f)} exports ${name}`);
      }
    }
    assert.deepEqual(offences, [], 'A *Repo-named export under storage/ is a repo living in a PORT file.');
  });
});

describe('persistence vocabulary — CHECK 4: "store" is eliminated from the codebase entirely', () => {
  it('no exported symbol anywhere is named *Store or *store (the word is banned, not relocated)', () => {
    const offences: string[] = [];
    for (const f of [...filesUnder(UI_SRC), ...filesUnder(PERSISTENCE_SRC)]) {
      for (const name of topLevelExportedNames(f)) {
        // Case-sensitive on the suffix "Store"/"store" as a whole word component — matches
        // `KeyValueStore`, `createFileStore`, `PrefsStore`, but not `Storage`/`storage` (a
        // different, sanctioned word) or an unrelated identifier that merely contains "store"
        // as a substring inside a longer word with no boundary (there are none in this tree).
        if (/(^|[a-z])Store$/.test(name) || /^store$/.test(name)) {
          offences.push(`${rel(f)} exports ${name}`);
        }
      }
    }
    assert.deepEqual(offences, [],
      'The word "store" is eliminated from the codebase (ruling, PERSISTENCE_NAMING_AND_' +
      'PLACEMENT.md top). The port is STORAGE (`KeyValueStorage`, `FileStorage`), the app ' +
      'state is `appState`, and nothing is a store — not even a synonym-carrying alias.');
  });

  it('no local/module-level binding is literally named `store` (the STORAGE gloss binds it `storage`)', () => {
    const offences: string[] = [];
    for (const f of [...filesUnder(UI_SRC), ...filesUnder(PERSISTENCE_SRC)]) {
      const source = sourceFileOf(f);
      source.forEachDescendant(node => {
        if (!Node.isVariableDeclaration(node)) return;
        if (node.getName() === 'store') offences.push(`${rel(f)}: const/let store = …`);
      });
    }
    assert.deepEqual(offences, [],
      'A binding named `store` reintroduces the eliminated word at the call site even when the ' +
      'type is honestly `KeyValueStorage` — name it `storage` (or a more specific noun) instead.');
  });
});

describe('persistence vocabulary — CHECK 5: "Library"/"Bucket" name no module or exported type', () => {
  it('no module path under persistence/ or logic/ contains "Library" or "Bucket"', () => {
    const offences: string[] = [];
    for (const f of [...filesUnder(PERSISTENCE_DIR), ...filesUnder(join(UI_SRC, 'logic'))]) {
      const base = rel(f);
      if (/Library|Bucket/i.test(base)) offences.push(base);
    }
    assert.deepEqual(offences, [],
      '"library" reads as a collection but names neither the medium nor the collection role ' +
      '(banned, PERSISTENCE_NAMING_AND_PLACEMENT.md §Banned words); "bucket" is a fourth word ' +
      'for what is already called a store/storage. Rename to the medium or the collection.');
  });

  it('no exported type/interface/class name contains "Library" or "Bucket"', () => {
    const offences: string[] = [];
    for (const f of [...filesUnder(UI_SRC), ...filesUnder(PERSISTENCE_SRC)]) {
      const source = sourceFileOf(f);
      const typeNames = [
        ...source.getInterfaces().filter(i => i.isExported()).map(i => i.getName()),
        ...source.getTypeAliases().filter(t => t.isExported()).map(t => t.getName()),
        ...source.getClasses().filter(c => c.isExported()).map(c => c.getName() ?? ''),
      ];
      for (const name of typeNames) {
        if (/Library|Bucket/.test(name)) offences.push(`${rel(f)} exports type ${name}`);
      }
    }
    assert.deepEqual(offences, [],
      'A type/interface/class named *Library or *Bucket is exactly the confusion this rule ' +
      'bans — it reads as a collection but names neither the medium nor the collection role.');
  });
});
