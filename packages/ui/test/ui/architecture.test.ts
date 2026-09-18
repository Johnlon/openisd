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
 * The layering gate (ARCHITECTURE.md §2).
 *
 *     ui  ->  logic  ->  services  ->  domain
 *
 * Every import points DOWNWARD, one layer at a time. No upward import, no lateral import
 * between siblings, no skipping a layer. A service takes its collaborators as arguments and
 * hands back data; it never reaches back into the application's state.
 *
 * These assertions match the SHAPE of the code — the import specifier and the exported
 * declaration — via the TypeScript AST (ts-morph), never text-pattern matching. A gate that
 * fails because a comment mentions a module name is a broken gate: it manufactures false
 * positives, and the usual "fix" is a rename that changes no behaviour and destroys the evidence.
 */
import { describe, it, vi } from 'vitest';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';
import { Project as TsProject, Node, SyntaxKind, type SourceFile } from 'ts-morph';

// Every gate in this file walks the source tree and builds ASTs — parse-bound work, not the
// function-call unit tests vitest's 5 s default budget is calibrated for. Stated explicitly so
// a gate cannot go red for CPU contention during a full-suite run and be read as a real
// offence: a timeout reports no offence list at all, which looks nothing like a genuine failure.
vi.setConfig({ testTimeout: 60_000 });

const UI_SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');

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

/** A `.vue` file's `<script>` block, parsed as a virtual TS source file so the rest of the
 *  file's queries can treat a component exactly like a module — imports, exports, classes,
 *  top-level statements — all live inside that block. A plain `.ts` file is used as-is. */
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

/**
 * Every module specifier a VALUE import pulls in. `import type` erases at compile time —
 * it creates no runtime edge, so it cannot make one file depend on another's behaviour. Every
 * assertion in this file reasons about runtime dependency, so every one of them must ignore a
 * type-only import; a gate that flags one is flagging nothing. A bare `import '...'` (no
 * clause) has no bindings to erase — it runs the module for its side effects, so it always
 * counts.
 */
function importsOf(file: string): string[] {
  const source = sourceFileOf(file);
  const specs: string[] = [];
  for (const imp of source.getImportDeclarations()) {
    const spec = imp.getModuleSpecifierValue();
    const clause = imp.getImportClause();
    if (!clause) { specs.push(spec); continue; }
    if (imp.isTypeOnly()) continue;
    const namedBindings = clause.getNamedBindings();
    const hasDefaultOrNamespace = !!clause.getDefaultImport() || namedBindings?.getKind() === SyntaxKind.NamespaceImport;
    const namedImports = namedBindings?.asKind(SyntaxKind.NamedImports)?.getElements() ?? [];
    const hasValueNamed = namedImports.some(ni => !ni.isTypeOnly());
    if (hasDefaultOrNamespace || hasValueNamed) specs.push(spec);
  }
  return specs;
}

/** Which layer a specifier resolves into, judged from the path it names. */
function layerOf(spec: string): 'ui' | 'logic' | 'service' | 'domain' | 'external' {
  if (spec === '@openisd/persistence' || /(^|\/)(persistence)\//.test(spec) || /(^|\/)(diagnostics|logging)\//.test(spec)) return 'service';
  if (/(^|\/)logic\//.test(spec)) return 'logic';
  if (/(^|\/)ui\//.test(spec) || spec.endsWith('.vue')) return 'ui';
  if (spec.startsWith('@openisd/')) return 'domain';
  return 'external';
}

/**
 * Every VALUE import statement in a file, as (module specifier, bound names) pairs — a finer
 * grain than `importsOf()`, which only needs the specifier. Reuses the same type-only-import
 * erasure rule: `import type` and a `type X` inside `{ }` bind no runtime name. Both the
 * imported (module-export) name and its local alias are recorded, matching the sense every
 * call site actually checks against — the name the exporting module publishes.
 */
function valueImportsOf(file: string): { spec: string; names: string[] }[] {
  const source = sourceFileOf(file);
  const out: { spec: string; names: string[] }[] = [];
  for (const imp of source.getImportDeclarations()) {
    if (imp.isTypeOnly()) continue;
    const spec = imp.getModuleSpecifierValue();
    const names: string[] = [];
    const def = imp.getDefaultImport();
    if (def) names.push(def.getText());
    const ns = imp.getNamespaceImport();
    if (ns) names.push(ns.getText());
    for (const ni of imp.getNamedImports()) {
      if (ni.isTypeOnly()) continue;
      names.push(ni.getName());
      const alias = ni.getAliasNode();
      if (alias) names.push(alias.getText());
    }
    if (names.length) out.push({ spec, names });
  }
  return out;
}

const rel = (f: string) => relative(UI_SRC, f);

const MODEL_SRC = join(UI_SRC, '..', '..', 'design', 'domain');
const WINISD_SRC = join(UI_SRC, '..', '..', 'design', 'winisd');
// The data-access tier (repos/storage) is its own package now, not a ui/src directory
// (John's ruling: a real 3-tier package boundary, not a directory convention).
const INI_SRC = join(UI_SRC, '..', '..', 'design', 'ini');
const PERSISTENCE_SRC = join(UI_SRC, '..', '..', 'persistence', 'src');
const ENGINE_SRC = join(UI_SRC, '..', '..', 'design', 'engine');

describe('layering — every arrow points downward', () => {
  it('a service never imports the application state or the logic layer', () => {
    const services = [PERSISTENCE_SRC, join(UI_SRC, 'diagnostics'), join(UI_SRC, 'logging')]
      .flatMap(filesUnder);
    assert.ok(services.length > 0, 'no service files found — the gate would pass vacuously');

    const offences = services.flatMap(f =>
      importsOf(f)
        .filter(s => layerOf(s) === 'logic')
        .map(s => `${rel(f)} imports ${s}`));

    assert.deepEqual(offences, [],
      'A service must take what it needs as an argument and return data. Importing the store ' +
      'inverts the dependency and drags the application layer into the service.');
  });

  it('a service never imports a sibling service', () => {
    const groups = { persistence: PERSISTENCE_SRC, diagnostics: join(UI_SRC, 'diagnostics'), logging: join(UI_SRC, 'logging') };
    const offences: string[] = [];
    for (const [own, dir] of Object.entries(groups)) {
      for (const f of filesUnder(dir)) {
        for (const s of importsOf(f)) {
          if (layerOf(s) !== 'service') continue;
          const named = Object.keys(groups).find(g => new RegExp(`(^|/)${g}/`).test(s));
          if (named && named !== own) offences.push(`${rel(f)} imports ${s}`);
        }
      }
    }
    assert.deepEqual(offences, [], 'Services are siblings; one may not depend on another.');
  });

  it('the presentation layer depends on logic and nothing below it', () => {
    const offences = filesUnder(join(UI_SRC, 'ui')).flatMap(f =>
      importsOf(f)
        .filter(s => layerOf(s) === 'service' || layerOf(s) === 'domain')
        .map(s => `${rel(f)} imports ${s}`));

    assert.deepEqual(offences, [],
      'ui depends on logic and nothing else. Reaching past it — into a service, into the ' +
      'engine, or into the serialiser — skips a layer, and a second front-end would have to ' +
      're-wire those calls rather than only re-skinning.');
  });

  it('a component imports no value from the domain — a type-only import is not a dependency', () => {
    const offences = filesUnder(join(UI_SRC, 'ui')).flatMap(f =>
      importsOf(f)
        .filter(s => layerOf(s) === 'domain')
        .map(s => `${rel(f)} imports ${s}`));

    assert.deepEqual(offences, [],
      'Physics belongs behind logic. A component calling the engine directly puts a formula ' +
      'call in the view, so the maths cannot be changed without editing components.');
  });

  it('logic and the services hold no view components', () => {
    const files = [join(UI_SRC, 'logic'), PERSISTENCE_SRC, join(UI_SRC, 'diagnostics'), join(UI_SRC, 'logging')]
      .flatMap(filesUnder);
    const offences = files.flatMap(f =>
      importsOf(f).filter(s => s.endsWith('.vue')).map(s => `${rel(f)} imports ${s}`));

    assert.deepEqual(offences, [], 'Below presentation, nothing knows a component exists.');
  });
});

describe('inversion of control — collaborators are injected, never reached for', () => {
  const CONSTRUCTED = [PERSISTENCE_SRC, join(UI_SRC, 'diagnostics'), join(UI_SRC, 'logging')];
  const REACTIVE_FACTORIES = new Set(['ref', 'shallowRef', 'reactive', 'shallowReactive']);

  it('a service exports no mutable module-level binding', () => {
    const offences: string[] = [];
    for (const f of CONSTRUCTED.flatMap(filesUnder)) {
      const source = sourceFileOf(f);
      for (const vs of source.getVariableStatements()) {
        if (!vs.isExported()) continue;
        const kind = vs.getDeclarationKind();
        if (kind !== 'let' && kind !== 'var') continue;
        for (const decl of vs.getDeclarations()) offences.push(`${rel(f)}: export ${kind} ${decl.getName()}`);
      }
    }
    assert.deepEqual(offences, [],
      'Exported mutable bindings are globals. State belongs to the layer that owns it, ' +
      'reached through a value the caller passed in.');
  });

  it('a service exports no pre-built instance — it exports a factory the caller wires', () => {
    const offences: string[] = [];
    for (const f of CONSTRUCTED.flatMap(filesUnder)) {
      const source = sourceFileOf(f);
      for (const vs of source.getVariableStatements()) {
        if (!vs.isExported() || vs.getDeclarationKind() !== 'const') continue;
        for (const decl of vs.getDeclarations()) {
          const init = decl.getInitializer();
          if (!init) continue;
          if (Node.isNewExpression(init)) {
            offences.push(`${rel(f)}: export const ${decl.getName()} = new ${init.getExpression().getText()}(...)…`);
          } else if (Node.isCallExpression(init) && REACTIVE_FACTORIES.has(init.getExpression().getText())) {
            offences.push(`${rel(f)}: export const ${decl.getName()} = ${init.getExpression().getText()}(...)…`);
          }
        }
      }
    }
    assert.deepEqual(offences, [],
      'Export a create*() factory taking its collaborators as arguments. A module-level ' +
      'instance cannot be substituted, so every consumer becomes untestable in isolation.');
  });

  it('every service module offers a create*() factory', () => {
    const missing: string[] = [];
    for (const dir of CONSTRUCTED) {
      const modules = filesUnder(dir).filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts'));
      for (const f of modules) {
        const source = sourceFileOf(f);
        const hasCallableExport = source.getFunctions().some(fn => fn.isExported())
          || source.getClasses().some(c => c.isExported());
        // A module that exports nothing callable is a type or constant module — nothing to wire.
        if (!hasCallableExport) continue;
        const hasFactory = source.getFunctions().some(fn => fn.isExported() && /^create[A-Z]/.test(fn.getName() ?? ''));
        if (!hasFactory) missing.push(rel(f));
      }
    }
    assert.deepEqual(missing, [],
      'One consistent construction pattern: create<Name>(deps) returns the service. ' +
      'Consumers receive it; they never import a ready-made one.');
  });
});

/**
 * ARCHITECTURE.md §3 and the dependency-rules table (§2): a driver's state lives inside
 * `OpenISDProject` (`packages/design`), and `packages/ui` reaches it through the project.
 * Constructing an `OpenISDDriver` from nothing — an empty driver, or one parsed out of file
 * text — is the one thing the ui still does for itself, and it is confined to the three
 * `logic/` modules that own driver file IO and the editor's draft.
 */
describe('only the licensed logic modules construct an OpenISDDriver', () => {
  /**
   * The three licensed constructors, listed rather than pattern-matched so a fourth file
   * cannot quietly join them.
   *
   * - `driverDraft.ts` seeds the driver editor's draft — a blank driver for a new My Driver,
   *   or a detached copy of an existing one. It is the editing session's own state, held
   *   outside the component per the "a component holds no domain value" rule.
   * - `driverSelection.ts` turns a picker row or a file read off disk into a driver.
   * - `fileImportExport.ts` parses `.wdr` and `.owdr` text.
   */
  const LICENSED = [
    join(UI_SRC, 'logic', 'driverDraft.ts'),
    join(UI_SRC, 'logic', 'driverSelection.ts'),
    join(UI_SRC, 'logic', 'fileImportExport.ts'),
  ];

  it('each licensed file still exists and still constructs a driver', () => {
    const inert = LICENSED.filter(f => !existsSync(f) || !/OpenISDDriver\.\w+\s*\(/.test(readFileSync(f, 'utf8')));
    assert.deepEqual(inert.map(rel), [],
      'A file on the licensed list no longer constructs an OpenISDDriver — delete it from the ' +
      'list rather than leaving a hole in the containment rule for the next file to fall through.');
  });

  it('nothing outside the licensed files imports the OpenISDDriver value', () => {
    const files = filesUnder(UI_SRC).filter(f => !LICENSED.includes(f));
    const offences = files.flatMap(f =>
      valueImportsOf(f)
        .filter(vi => /(^|\/)@openisd\/design(\/|$)/.test(vi.spec) && vi.names.includes('OpenISDDriver'))
        .map(vi => `${rel(f)} imports OpenISDDriver from ${vi.spec}`));

    assert.deepEqual(offences, [],
      "A driver's state belongs to `OpenISDProject`; the ui reads it through the project. The " +
      'three licensed logic modules construct drivers only because file IO and the editor draft ' +
      'genuinely start from nothing. A further value import of the class is an uncontrolled path ' +
      'into driver state — it bypasses the project and the notifications it fires. A type-only ' +
      'import is fine: it erases, so it cannot reach the object.');
  });
});

/**
 * ARCHITECTURE.md §3: `OpenISDDriver` is the app's ONE driver model, and `@openisd/design/winisd`
 * is "solely a serialisation device". The classic `Driver` ADT (`packages/design/winisd/driver.ts`)
 * with its `DriverJSON`/`DriverRaw` shapes is the model it replaces — its own header condemns
 * it and forbids extending it.
 *
 * Two live driver models is the "ONE model version" violation in its purest form: two shapes
 * for one concept, each with its own provenance rules, its own derivation and its own
 * serialisation, free to disagree about the same driver.
 */
describe('one driver model — the classic Driver ADT is not part of the app', () => {
  it('no application file imports the condemned Driver class or its shapes', () => {
    const CONDEMNED = ['Driver', 'DriverJSON', 'DriverRaw', 'FieldCell'];
    const offences = filesUnder(UI_SRC).flatMap(f =>
      valueImportsOf(f)
        .filter(vi => /(^|\/)@openisd\/winisd(\/|$)/.test(vi.spec))
        .flatMap(vi => vi.names.filter(n => CONDEMNED.includes(n))
          .map(n => `${rel(f)} imports ${n} from ${vi.spec}`)));

    assert.deepEqual(offences, [],
      'The classic `Driver` ADT (packages/design/winisd/driver.ts) is the model `OpenISDDriver` ' +
      'REPLACES, and `@openisd/design/winisd` is a serialisation device only. Every import above is ' +
      'a second, competing driver model inside the application — with its own provenance, ' +
      'derivation and JSON shape, free to disagree with OpenISDDriver about the same driver. ' +
      'Migrate the call site onto ManagedProject/OpenISDDriver and delete the import; never ' +
      'fix or extend the condemned class in place.');
  });
});

/**
 * ARCHITECTURE.md §"Approved state stores — there are THREE, and no others".
 *
 * The store holds which projects are open and which is focused; each `OpenISDProject` holds its
 * own driver, box and edit state; `presentationState` and `urlAppState` hold presentation state
 * and the visible URL. EVERY other component is a slave to those — it reads and writes through them and holds nothing of its own.
 *
 * A local copy of state one of the three already holds is a SECOND ANSWER to the same question,
 * and two answers are free to disagree.
 */
describe('only the approved stores hold state', () => {
  const APPROVED = [
    join(UI_SRC, 'logic', 'appState.ts'),
    join(UI_SRC, 'logic', 'presentationState.ts'),   // not built yet — see ARCHITECTURE.md
    join(UI_SRC, 'logic', 'urlAppState.ts'),
  ];
  const REACTIVE_FACTORIES = new Set(['ref', 'shallowRef', 'reactive', 'shallowReactive']);

  /** Every MODULE-level (top-level statement, not nested in a function/class/setup body)
   *  `const|let|var X = ref(...)/reactive(...)/...` binding — using the AST's own notion of
   *  "top-level statement" instead of guessing from indentation, which a differently-formatted
   *  file (tabs, 4-space, `<script setup>` boilerplate) could dodge under a column-anchored
   *  regex. Such a binding outlives every component and IS a store by another name. */
  function moduleLevelReactiveBindings(file: string): { kind: string; name: string }[] {
    const source = sourceFileOf(file);
    const out: { kind: string; name: string }[] = [];
    for (const vs of source.getVariableStatements()) {
      for (const decl of vs.getDeclarations()) {
        const init = decl.getInitializer();
        if (!init || !Node.isCallExpression(init)) continue;
        const callee = init.getExpression().getText();
        if (REACTIVE_FACTORIES.has(callee)) out.push({ kind: callee, name: decl.getName() });
      }
    }
    return out;
  }

  it('no module outside the approved stores holds module-level reactive state', () => {
    const files = filesUnder(UI_SRC)
      .filter(f => f.endsWith('.ts'))
      .filter(f => !APPROVED.includes(f));

    const offences: string[] = [];
    for (const f of files) {
      for (const { kind, name } of moduleLevelReactiveBindings(f)) offences.push(`${rel(f)}: ${kind} ${name}`);
    }

    assert.deepEqual(offences, [],
      'Only the approved stores may hold state: appState (which projects are open and which is ' +
      'focused), presentationState (presentation, browser-backed), urlAppState (the URL that ' +
      'encapsulates the app state). A driver or box belongs to its OpenISDProject. Each binding ' +
      'above is a fourth store — module-level, outliving every component, reachable by import, ' +
      'and free to disagree with whichever approved store already answers the same question. ' +
      'Delete it and call the approved store, every time; never cache a copy for convenience.');
  });
});

/**
 * ARCHITECTURE.md §"Approved state stores" and §3: the containment must be TOTAL.
 *
 *     everything  ->  appState  ->  OpenISDProject  ->  OpenISDDriver
 *
 * Each arrow is the ONLY way through. `appState.ts` holds which projects are open and which is
 * focused; the project owns its driver. A single leak makes the whole chain advisory: one
 * caller holding the driver directly can mutate it with no notification, which is the exact
 * defect this architecture exists to make impossible.
 */
describe('containment is total: appState -> OpenISDProject -> OpenISDDriver', () => {
  const STORE = join(UI_SRC, 'logic', 'appState.ts');

  it('appState never hands an OpenISDDriver out — every exported function returns data', () => {
    // AST-driven (ts-morph), not text-pattern: every exported function whose declared return
    // type names OpenISDDriver is a leak, regardless of how it is written.
    const localProject = new TsProject({ tsConfigFilePath: join(UI_SRC, '..', 'tsconfig.json'), skipAddingFilesFromTsConfig: true });
    const sf = localProject.addSourceFileAtPath(STORE);
    const offences: string[] = [];
    for (const fn of sf.getFunctions()) {
      if (!fn.isExported()) continue;
      const text = fn.getReturnType().getText();
      if (text.includes('OpenISDDriver')) offences.push(`${fn.getName()}() returns ${text}`);
    }

    assert.deepEqual(offences, [],
      'A driver is `OpenISDProject`\'s state, not the store\'s. A store function returning one ' +
      'hands the project\'s driver to the caller, who can then mutate it behind the project with ' +
      'no notification. Return the DATA the caller needs — a Cell, a display row, an engine ' +
      'driver — never the object.');
  });

  /** File IO is the one other place a project is built from nothing — `.wpr`/`.owpr` text
   *  parsed off disk, before any registry exists to hand it to. Named, not pattern-matched. */
  const PROJECT_FILE_IO = join(UI_SRC, 'logic', 'fileImportExport.ts');

  it('the store is the only logic module that holds the project registry', () => {
    const offences = filesUnder(UI_SRC)
      .filter(f => f !== STORE && f !== PROJECT_FILE_IO)
      .flatMap(f => valueImportsOf(f)
        .filter(vi => /(^|\/)@openisd\/design(\/|$)/.test(vi.spec) && vi.names.includes('OpenISDProject'))
        .map(() => `${rel(f)} imports the OpenISDProject CLASS`));

    assert.deepEqual(offences, [],
      'The store constructs and holds the open projects; everything else reaches them as ' +
      '`focusedProject()`/`openProjects()` from the store. Importing the class elsewhere is how a ' +
      'SECOND project state appears — two registries are two answers to "which project is open". ' +
      'fileImportExport.ts is licensed because it parses a project out of file text.');
  });

  it('NO ui file may name WinISDDriver as a value', () => {
    const offences = filesUnder(UI_SRC)
      .flatMap(f => valueImportsOf(f)
        .filter(vi => /(^|\/)@openisd\/winisd(\/|$)/.test(vi.spec))
        .flatMap(vi => vi.names
          .filter(n => n === 'WinISDDriver')
          .map(() => `${rel(f)} imports WinISDDriver as a VALUE`)));

    assert.deepEqual(offences, [],
      'WinISDDriver is the .wdr FILE FORMAT boundary, not a driver representation, and it ' +
      'never enters the ui package at all. A file wanting .wdr text calls the symmetric pair ' +
      'on the driver itself — OpenISDDriver.fromWdrText(text) / driver.toWdrText() — which is ' +
      'where the projection lives. A type-only import is fine — it erases, so it cannot reach ' +
      'the class.');
  });
});

const ALL_SRC_FILES = [...filesUnder(UI_SRC), ...filesUnder(MODEL_SRC), ...filesUnder(WINISD_SRC), ...filesUnder(INI_SRC), ...filesUnder(PERSISTENCE_SRC), ...filesUnder(ENGINE_SRC)];
const REPO_ROOT = join(UI_SRC, '..', '..');

/**
 * Human ruling (QO52, closed 2026-08-18; RETIRED 2026-08-23): appState.ts's export surface was
 * once restricted to `openProjects()`/`focusedProject()` by name, enforced by the per-export
 * ALLOWED_GLOBALS checklist below. That checklist is gone.
 *
 * Human ruling (QO80, closed 2026-08-23, verbatim): "since ui modules are at the top of the
 * tree then there should [be] nothing exported to other lower dirs, I am not so concerned about
 * individual files at the moment but the orderly layering — make sure QO80 is closed if it's
 * still bothered by file-level stuff and instead make sure we have layering and enforcement
 * covered." The per-export ALLOWED_GLOBALS grant checklist (QO72's ALL_SRC_FILES scan, a
 * human-edit-only array per file) is RETIRED — no file-by-file grant list, no per-module
 * `ALLOWED_GLOBALS` array. Enforcement pivots entirely to the ORDERLY LAYERING checked below:
 * which layer may depend on which, never which individual name a file happens to export.
 */

/** Coarse layer bucket for a file path, judged from its directory — shared by both layering
 *  gates below (the upward-import ban and the layer-edge legality matrix). */
function fileLayer(file: string): string {
  if (file.startsWith(MODEL_SRC)) return 'model';
  if (file.startsWith(WINISD_SRC)) return 'winisd';
  if (file.startsWith(INI_SRC)) return 'ini';
  if (file.startsWith(ENGINE_SRC)) return 'engine';
  if (file.startsWith(PERSISTENCE_SRC)) {
    const pr = relative(PERSISTENCE_SRC, file).replace(/\\/g, '/');
    if (pr.startsWith('repos/')) return 'persistence-repos';
    if (pr.startsWith('storage/')) return 'persistence-storage';
    return 'persistence';
  }
  const r = relative(UI_SRC, file).replace(/\\/g, '/');
  if (r.startsWith('..')) return 'ui/other';
  if (/(^|\/)test\//.test(r) || file.includes(`${sep}test${sep}`)) return 'ui/test';
  if (file === join(UI_SRC, 'main.ts')) return 'ui/entrypoint';
  if (r.startsWith('logic/')) return 'ui/logic';
  if (r.startsWith('hooks/')) return 'ui/hooks';
  if (r.startsWith('diagnostics/')) return 'ui/diagnostics';
  if (r.startsWith('logging/')) return 'ui/logging';
  if (r.startsWith('ui/')) return 'ui/components';
  if (!r.includes('/')) return 'ui/root';
  return `ui/other:${r.split('/')[0]}`;
}

/** Resolve a value-import specifier to the layer it names — a bare `@openisd/*` package maps
 *  directly; a relative specifier is resolved against the importing file and classified by
 *  `fileLayer()`, same as the file it points at. Returns null for an npm package (irrelevant
 *  to the app's own layering) or a specifier that cannot be resolved to a file on disk. */
function specLayer(fromFile: string, spec: string): string | null {
  // Most specific first: the domain, the engine and the converters are subpaths of ONE package,
  // so the bare specifier is a text prefix of every subpath and must be tested last.
  if (spec.startsWith('@openisd/design/winisd')) return 'winisd';
  if (spec.startsWith('@openisd/design/engine')) return 'engine';
  if (spec.startsWith('@openisd/design')) return 'model';
  if (spec.startsWith('@openisd/persistence')) return 'persistence';
  if (spec.startsWith('@openisd/')) return null;
  if (!spec.startsWith('.')) return null;
  const base = join(dirname(fromFile), spec).replace(/\.js$/, '');
  for (const candidate of [`${base}.ts`, `${base}.vue`, base]) {
    if (ALL_SRC_FILES.includes(candidate)) return fileLayer(candidate);
  }
  return null;
}

describe('layering — nothing outside ui imports from ui (QO80: "ui modules are at the top of the tree")', () => {
  it('no file in logic, persistence, model, winisd, or engine imports a ui/ module or a .vue file', () => {
    const offences: string[] = [];
    for (const f of ALL_SRC_FILES) {
      const layer = fileLayer(f);
      if (layer.startsWith('ui/')) continue; // ui files importing sibling ui files is expected
      for (const s of importsOf(f)) {
        if (/(^|\/)ui\//.test(s) || s.endsWith('.vue')) offences.push(`${fileLayer(f)}: ${rel(f)} imports ${s}`);
      }
    }
    assert.deepEqual(offences, [],
      'ui is the top of the tree (QO80, John: "there should [be] nothing exported to other ' +
      'lower dirs"). Nothing below ui — logic, persistence, model, winisd, engine — may import ' +
      'a ui/ module or a .vue file. That dependency runs the wrong direction.');
  });
});

describe('layer-edge legality — the ruled dependency matrix (QO80 closure, 2026-08-23)', () => {
  // Every (importer layer -> depends-on layer) edge John has ruled legal, either directly
  // (the QO80 triage session's layer-matrix ruling) or by the pre-existing downward-layering
  // gates above (ui/components -> ui/logic, ui/logic -> model, etc.). `ui/entrypoint`
  // (main.ts, the composition root) is exempt below — it legitimately wires every layer.
  const ALLOWED_EDGES = new Set([
    'ui/components->ui/logic', 'ui/components->model', 'ui/components->ui/root', 'ui/components->ui/hooks',
    'ui/hooks->ui/logic', 'ui/hooks->model', 'ui/hooks->ui/root',
    'ui/logic->model', 'ui/logic->persistence', 'ui/logic->ui/root', 'ui/logic->winisd', 'ui/logic->engine',
    'persistence-repos->model', 'persistence-repos->engine', 'persistence-storage->model',
    'model->winisd', // human-approved 2026-08-23: toWinISDDriver/toWinISDProject/fromWinISDProject
    'winisd->model', // the correct-direction bridge (winisd/src/bridge.ts)
    'winisd->ini', // human-approved 2026-09-09 ("wdr may import ini"): .wdr/.wpr ARE Windows INI files

    'ui/diagnostics->ui/root', 'ui/logging->ui/root',
    'ui/diagnostics->engine', // selftest.ts exercises the engine to self-check it's callable
    'model->engine', // the domain layer computes against engine's calc types (e.g. driverSimulatability)
  ]);

  it('every cross-layer import matches a ruled-legal edge', () => {
    const offences: string[] = [];
    let edgesObserved = 0;
    for (const f of ALL_SRC_FILES) {
      const fromLayer = fileLayer(f);
      if (fromLayer === 'ui/entrypoint' || fromLayer === 'ui/test') continue; // composition root / tests: exempt
      for (const s of importsOf(f)) {
        const toLayer = specLayer(f, s);
        if (!toLayer || toLayer === fromLayer) continue; // unresolved (npm package) or same-layer composition
        edgesObserved++;
        const edge = `${fromLayer}->${toLayer}`;
        if (!ALLOWED_EDGES.has(edge)) offences.push(`${edge}: ${rel(f)} imports ${s}`);
      }
    }
    assert.ok(edgesObserved > 0, 'no cross-layer edges observed — the gate would pass vacuously');
    assert.deepEqual(offences, [],
      'This edge is not on the ruled legality matrix (QO80, 2026-08-23). Either it is a genuine ' +
      'new layering violation (fix the dependency direction or relocate the export, as with the ' +
      'DriverType move), or it is a new legitimate edge that needs the human\'s ruling added to ' +
      'ALLOWED_EDGES above — an agent may not widen ALLOWED_EDGES on its own authority, same as ' +
      'the retired ALLOWED_GLOBALS rule.');
  });

  it('the gate can fail (non-vacuous demonstration): the matrix distinguishes a ruled-legal edge from an unruled one', () => {
    // This detector is a Set-membership check, not an AST pattern-matcher (unlike the export *
    // ratchet above) — the honest demonstration is that the Set itself separates a known-legal
    // edge from a known-unruled one, proving ALLOWED_EDGES is not vacuously permissive.
    assert.equal(ALLOWED_EDGES.has('ui/logic->model'), true, 'a real ruled-legal edge must be recognised');
    // any edge not on the matrix will do — replace if this one is ever ruled.
    assert.equal(ALLOWED_EDGES.has('ui/components->winisd'), false,
      'an edge nobody ruled legal must be absent from the matrix, proving it is not vacuously permissive');
  });

  it('classifies each @openisd/design subpath as its own layer, not as the domain', () => {
    // The domain, the engine and the WinISD converters are three SUBPATHS of one package, so
    // `@openisd/design` is a text prefix of `@openisd/design/engine`. A specifier must be
    // judged by the deepest subpath it names: classifying an engine import as the domain makes
    // a physics dependency indistinguishable from a record dependency, and ALLOWED_EDGES then
    // judges each against the other's rules.
    const anyUiFile = join(UI_SRC, 'main.ts');

    assert.equal(specLayer(anyUiFile, '@openisd/design/engine'), 'engine');
    assert.equal(specLayer(anyUiFile, '@openisd/design/winisd'), 'winisd');
    assert.equal(specLayer(anyUiFile, '@openisd/design'), 'model');
    assert.equal(specLayer(anyUiFile, '@openisd/persistence'), 'persistence');
  });
});


/**
 * Human ruling (QO86, closed 2026-08-23, verbatim): "generally nothing should be public or
 * exported and that export * is a serious violation of control and arch, and we need an arch
 * test to detect it and block it in favour of named selective intentional exports of own code
 * and never a re-exported symbol." Refined execution (same day, verbatim): "make the exports
 * check take a baseline from current state so it isn't blocking our release, but a fail if new
 * wildcards are added ... for now let's take a baseline and add the tests, then as a
 * non-blocking unit of work convert all wildcard to specific and remove the wildcard from the
 * baseline, but not as a release blocker."
 *
 * A RATCHET, not a born-red checklist: `EXPORT_STAR_BASELINE` below is the exact symbol set
 * every pre-existing `export * from X` site re-exports (re-recorded 2026-09-09 for packages/design),
 * generated mechanically from the AST, not hand-typed. The gate passes on this snapshot and
 * fails on (a) any `export *` anywhere not in the baseline — a brand-new violation, or
 * (b) a baselined site whose CURRENTLY-resolved symbol set is a superset of its baseline — a
 * new symbol smuggled through an old star. `@openisd/persistence`'s barrel is born compliant
 * (named exports only, see `packages/persistence/src/index.ts`) and carries no baseline row.
 * Converting each remaining row to named exports (deleting it from the baseline as it
 * converts, until the baseline is empty and the ban is absolute) is separate, non-blocking work
 * — not this gate's job.
 */
const EXPORT_STAR_BASELINE: Record<string, Record<string, string[]>> = {
  'design/ini/index.ts': {
    './ini.js': ['Ini', 'parseIni', 'stringifyIni'],
  },
  'design/winisd/index.ts': {
    './cellState.js': ['CellState', 'CellStateSchema'],
    './winisdBytes.js': ['WINISD_NEWLINE_SENTINEL', 'WinisdDecodedText', 'WinisdEncoding', 'winisdBytesToText', 'winisdTextToBytes'],
    './winisdProject.js': ['WinISDProject'],
    './winisdDriver.js': ['INI_ROWS', 'INI_ROWS_META', 'WINISD_CALCULABLE', 'WdrCell', 'WdrEnv', 'WdrHeader', 'WinISDDriver'],
    './parstate.js': ['PARSTATE_LEN', 'POS_TO_WDRKEY', 'ParStateError', 'markOf', 'parseParState', 'provenanceOf'],
  },
};
/** Every bare `export * from '...'` in a file — no named bindings, no namespace alias — with
 *  the target module's own current top-level exported names (one level, matching exactly what
 *  `export *` re-exports from that specifier). `unresolved` is true when the specifier could
 *  not be resolved to a source file (a moved file, stale project state) — the caller must treat
 *  that as a FAILURE, never as "this site re-exports nothing": an unresolvable target is a gap
 *  in what the gate can see, not evidence the site is empty or compliant. */
function starSitesIn(source: SourceFile): { spec: string; names: string[]; unresolved: boolean }[] {
  const sites: { spec: string; names: string[]; unresolved: boolean }[] = [];
  for (const exp of source.getExportDeclarations()) {
    if (exp.getNamedExports().length > 0 || exp.getNamespaceExport()) continue;
    const spec = exp.getModuleSpecifierValue();
    if (!spec) continue; // `export *` always has a `from` clause; this is unreachable in practice
    const target = exp.getModuleSpecifierSourceFile();
    sites.push({ spec, names: target ? [...target.getExportedDeclarations().keys()].sort() : [], unresolved: !target });
  }
  return sites;
}

describe('export * ratchet — the gate can fail (non-vacuous demonstration)', () => {
  it('reports resolved names, detects baseline growth, and flags an unresolved target as a failure', () => {
    const demo = new TsProject({ useInMemoryFileSystem: true });
    demo.createSourceFile('/target.ts', 'export const a = 1;\nexport const b = 2;\n');
    const barrel = demo.createSourceFile('/barrel.ts', "export * from './target';\n");
    const [resolved] = starSitesIn(barrel);
    assert.equal(resolved.unresolved, false);
    assert.deepEqual(resolved.names, ['a', 'b']);
    // Growth beyond a baseline of only 'a' — the same comparison the real gate makes below.
    assert.deepEqual(resolved.names.filter(n => !['a'].includes(n)), ['b']);

    const dangling = demo.createSourceFile('/dangling.ts', "export * from './nowhere';\n");
    const [missing] = starSitesIn(dangling);
    assert.equal(missing.unresolved, true,
      'an unresolvable star target must be flagged, never silently treated as an empty export list');
  });
});

describe('export * is banned outright — QO86 ratchet (baseline now, zero eventually)', () => {
  it('no export * site outside the recorded baseline, and no baselined site has grown', () => {
    const offences: string[] = [];
    let starSitesObserved = 0;
    for (const f of ALL_SRC_FILES) {
      const key = relative(REPO_ROOT, f).replace(/\\/g, '/');
      const baseline = EXPORT_STAR_BASELINE[key];
      for (const { spec, names, unresolved } of starSitesIn(sourceFileOf(f))) {
        starSitesObserved++;
        if (unresolved) {
          offences.push(`${key}: export * from '${spec}' did not resolve to a source file — cannot ` +
            'verify what it re-exports, so this counts as a violation, not a pass');
          continue;
        }
        const baselineNames = baseline?.[spec];
        if (!baselineNames) {
          offences.push(`${key}: NEW export * from '${spec}' — not on the QO86 baseline; convert to named exports`);
          continue;
        }
        const grown = names.filter(n => !baselineNames.includes(n));
        if (grown.length) {
          offences.push(`${key}: export * from '${spec}' now also re-exports ${grown.join(', ')} — growth beyond its QO86 baseline`);
        }
      }
    }
    assert.ok(starSitesObserved >= Object.values(EXPORT_STAR_BASELINE).flatMap(Object.keys).length,
      'the scan found fewer export * sites than the baseline records — the gate would pass vacuously');
    assert.deepEqual(offences, [],
      'export * is banned outright (QO86, John: "export * is a serious violation of control and ' +
      'arch"). A barrel lists its exports by name, selectively, intentionally. New wildcards are ' +
      'never allowed; an existing baselined wildcard may shrink (as it is converted to named ' +
      'exports) but never grow.');
  });
});

/**
 * Test-count floor gate.
 *
 * Prevents bulk deletion of browser tests. The count must not drop below the floor without a
 * human-signed ruling in questions.yml explaining why. If an AI deletes tests to make a red
 * suite go green, this gate catches the deletion and goes red instead.
 *
 * To raise the floor after new tests are added, count the current `test(` calls and update the
 * minimum accordingly.
 */
describe('browser test suite must not shrink without a ruling', () => {
  const UI_TEST_DIR = join(__dirname, '..');
  const BROWSER_SPECS: string[] = [];

  function collectBrowserSpecs(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        collectBrowserSpecs(join(dir, entry.name));
      } else if (entry.name.endsWith('.browser.spec.ts')) {
        BROWSER_SPECS.push(join(dir, entry.name));
      }
    }
  }
  collectBrowserSpecs(UI_TEST_DIR);

  it('has at least 40 browser spec files (current: 49)', () => {
    assert.ok(BROWSER_SPECS.length >= 40,
      `only ${BROWSER_SPECS.length} browser spec files found — floor is 40. ` +
      'If tests were legitimately removed, update this floor with a human ruling in questions.yml.');
  });

  it('has at least 200 test() calls across browser specs', () => {
    let testCount = 0;
    for (const file of BROWSER_SPECS) {
      const src = readFileSync(file, 'utf8');
      // Match test('... and test.describe('...' — both register a test. test.beforeEach is not counted.
      testCount += (src.match(/^\s*test\((?!\.beforeEach|\.afterEach)/gm) ?? []).length;
    }
    assert.ok(testCount >= 200,
      `only ${testCount} test() calls found across browser specs — floor is 200. ` +
      'If tests were legitimately removed, update this floor with a human ruling in questions.yml.');
  });
});
