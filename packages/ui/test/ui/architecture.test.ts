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

/**
 * The two CHECKLIST gates below (PrivateAllow, ALLOWED_GLOBALS) self-skip loudly under
 * `PRECOMMIT=1` (set only by scripts/hooks-local/pre-commit) so a standing checklist cannot
 * block every commit; in every other run they execute normally. This changes WHEN they run,
 * never what they assert. `ALLOWED_GLOBALS` is still born-red by design — its offence list IS
 * the human's to-do list, enforced at A10/`npm run ci`/health-check rather than per-commit.
 * `PrivateAllow` (the class-private gate below) is NOT that kind of checklist any more: an
 * import of a private name is a hard failure unless the (file, name) pair is individually
 * `HUMAN_GRANTED` in the gate itself — the wrapper is kept only because a handful of
 * pre-existing offences are still being worked down toward zero, not because open-ended
 * grants are how this gate is meant to be satisfied.
 */
const checklistDescribe = process.env.PRECOMMIT === '1'
  ? (name: string, fn: () => void) => {
      console.warn(`[pre-commit] SKIPPING checklist gate "${name}" — runs red in ci/health-check/A10`);
      return describe.skip(name, fn);
    }
  : describe;
import { readdirSync, readFileSync, statSync } from 'node:fs';
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

const MODEL_SRC = join(UI_SRC, '..', '..', 'model', 'src');
const WINISD_SRC = join(UI_SRC, '..', '..', 'winisd', 'src');
// The data-access tier (repos/storage) is its own package now, not a ui/src directory
// (John's ruling: a real 3-tier package boundary, not a directory convention).
const PERSISTENCE_SRC = join(UI_SRC, '..', '..', 'persistence', 'src');
const ENGINE_SRC = join(UI_SRC, '..', '..', 'engine', 'src');

/**
 * Every import of `name` from a module matching `specPattern` — type-only or value, since a
 * type erases at compile time but a type-only import is still a NAME that ties a file to a
 * shape, which is exactly what this gate restricts. Matches both a bare/default/namespace
 * import and a named import (aliased or not), for either an `import type {...}` declaration
 * or a plain `import {...}` that mixes `type X` with a value binding.
 */
function namedImportsOf(file: string, name: string, specPattern: RegExp): string[] {
  const source = sourceFileOf(file);
  const out: string[] = [];
  for (const imp of source.getImportDeclarations()) {
    const spec = imp.getModuleSpecifierValue();
    if (!specPattern.test(spec)) continue;
    const clause = imp.getImportClause();
    if (!clause) continue;
    const bound: string[] = [];
    const def = clause.getDefaultImport();
    if (def) bound.push(def.getText());
    const namedBindings = clause.getNamedBindings();
    const nsImport = namedBindings?.asKind(SyntaxKind.NamespaceImport);
    if (nsImport) bound.push(nsImport.getText());
    for (const ni of namedBindings?.asKind(SyntaxKind.NamedImports)?.getElements() ?? []) {
      bound.push(ni.getName());
      const alias = ni.getAliasNode();
      if (alias) bound.push(alias.getText());
    }
    if (bound.includes(name)) out.push(spec);
  }
  return out;
}

/** Does `file` contain a call expression whose callee text is exactly `expr` (e.g.
 *  `'OpenISDDriver.fromJsonRecord'`)? Used where a gate asserts a specific construction site
 *  still exists, rather than scanning imports or declarations. */
function callsExpression(file: string, expr: string): boolean {
  const source = sourceFileOf(file);
  let found = false;
  source.forEachDescendant(node => {
    if (found) return;
    if (Node.isCallExpression(node) && node.getExpression().getText() === expr) found = true;
  });
  return found;
}

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

  // The driver editor's sanctioned exemption: `@openisd/model` (the `OpenISDDriver` record and
  // its own class) is the domain's ONE data type, not a service — a component that constructs
  // and edits it directly is not skipping a layer the way a component computing physics would.
  // Human ruling: "the driver editor needs to work in terms of the existing OpenISDDriver
  // interface, not a facade — put the driver editor into its own module, allow it to access
  // OpenISDDriver directly, other views not allowed." Scoped to this ONE file by name, not to
  // `ui/**` generally — everything else, including `@openisd/engine` even for this same file,
  // stays banned below.
  const DRIVER_EDITOR = join(UI_SRC, 'ui', 'components', 'DriverEditorModal.vue');
  const isExemptModelImport = (f: string, s: string) => f === DRIVER_EDITOR && /(^|\/)@openisd\/model(\/|$)/.test(s);

  it('the presentation layer depends on logic and nothing below it', () => {
    const offences = filesUnder(join(UI_SRC, 'ui')).flatMap(f =>
      importsOf(f)
        .filter(s => (layerOf(s) === 'service' || layerOf(s) === 'domain') && !isExemptModelImport(f, s))
        .map(s => `${rel(f)} imports ${s}`));

    assert.deepEqual(offences, [],
      'ui depends on logic and nothing else. Reaching past it — into a service, into the ' +
      'engine, or into the serialiser — skips a layer, and a second front-end would have to ' +
      're-wire those calls rather than only re-skinning. (DriverEditorModal.vue is exempt for ' +
      '@openisd/model only — see the ruling above.)');
  });

  it('a component imports no value from the domain — a type-only import is not a dependency', () => {
    const offences = filesUnder(join(UI_SRC, 'ui')).flatMap(f =>
      importsOf(f)
        .filter(s => layerOf(s) === 'domain' && !isExemptModelImport(f, s))
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
 * ARCHITECTURE.md §3 "`ManagedOpenISDProject` — the one facade over every state layer", and the
 * dependency-rules table (§2): only `ManagedOpenISDProject` reaches `_OpenISDProjectJson`, and only
 * `_OpenISDProjectJson` reaches its members — the driver, the radiator, the box, the vent.
 * Everything else goes through the facade alone.
 */
describe('ManagedOpenISDProject is the only holder of OpenISDDriver', () => {
  const MANAGED_DRIVER_FILE = join(UI_SRC, 'logic', 'managedProject.ts');

  /**
   * The ONE exemption, and it is narrow.
   *
   * The driver editor holds a live `OpenISDDriver` as its DRAFT. It cannot use the pure record
   * readers instead, and the reason is specific: `clear()` restores the origin that a manual
   * edit displaced, and it does so from `#displaced` — state accumulated across that instance's
   * lifetime. A per-call pure function creates a new instance each time and has no such memory,
   * so "clear this field" would forget what the field said before the user typed over it.
   *
   * The draft is bounded: it belongs to one open modal, nothing else can reach it, it is
   * discarded on cancel, and on OK it leaves as a RECORD. It is never app state.
   *
   * It is listed here rather than pattern-matched so that a second file cannot quietly join it.
   */
  const DRAFT_HOLDER = join(UI_SRC, 'ui', 'components', 'DriverEditorModal.vue');

  /**
   * The managed-DRIVER file-IO module — licensed by QO78's ruling (human, 2026-08-22: "if the
   * file io relates to managed project then move it into manaedproject.ts if the file io
   * relates to manageddriver then movie it into manageddriver"): driver file IO that is not
   * bound to a project (disk/library rows → records for the repositories) constructs its
   * transient drivers HERE, inside the managed layer, rather than through a wrapper seam in
   * the model or an exemption for a service file.
   */
  const MANAGED_DRIVER_IO_FILE = join(UI_SRC, 'logic', 'managedDriver.ts');

  it('the draft exemption names a file that still exists and still holds a draft', () => {
    assert.ok(callsExpression(DRAFT_HOLDER, 'OpenISDDriver.fromOwdrText'),
      'DriverEditorModal.vue no longer holds a live draft — delete this exemption rather than ' +
      'leaving a hole in the containment rule for the next file to fall through. (It seeds the ' +
      'draft from the editor-seed TEXT the managed layer hands it, which is why the probe names ' +
      'fromOwdrText: nothing between the project and the editor parses a driver record.)');
  });

  it('nothing outside managedProject.ts imports the OpenISDDriver value', () => {
    const files = filesUnder(UI_SRC)
      .filter(f => f !== MANAGED_DRIVER_FILE && f !== DRAFT_HOLDER && f !== MANAGED_DRIVER_IO_FILE);
    const offences = files.flatMap(f =>
      valueImportsOf(f)
        .filter(vi => /(^|\/)@openisd\/model(\/|$)/.test(vi.spec) && vi.names.includes('OpenISDDriver'))
        .map(vi => `${rel(f)} imports OpenISDDriver from ${vi.spec}`));

    assert.deepEqual(offences, [],
      '`ManagedOpenISDProject` (packages/ui/src/logic/managedProject.ts) is the ONLY facade over a ' +
      "driver's ground/modified/edit-or-whatif state, and `managedDriver.ts` (QO78's ruling) is " +
      'the only other licensed constructor, for driver file IO not bound to a project. A ' +
      'further import of the OpenISDDriver class is an uncontrolled path into that state — it ' +
      'bypasses the edit/what-if overlay, the single-channel notification asymmetry, and the ' +
      'what-if-never-leaks cancellation guard `ManagedOpenISDProject` exists to enforce.');
  });

  it('managedProject.ts itself is the one file that constructs an OpenISDDriver', () => {
    assert.ok(callsExpression(MANAGED_DRIVER_FILE, 'OpenISDDriver.fromOwdrText'),
      'managedProject.ts no longer constructs an OpenISDDriver — either the facade was ' +
      'gutted, or construction moved to a helper file the previous assertion also needs to ' +
      'exempt. Update both together, never widen the exemption alone. (It materialises each ' +
      "layer's driver from the project's stored TEXT — QO83: the project holds the driver's " +
      'own serialisation, never its record — which is why the probe names fromOwdrText.)');
  });
});

/**
 * ARCHITECTURE.md §3: `ManagedOpenISDProject` wraps ground state, committed state, and an
 * edit-or-what-if overlay, and NOTHING outside it may hold, name, or reason about a
 * what-if. A component asks `ManagedOpenISDProject` whether a what-if is effective; it never
 * keeps its own flag, its own copy, or its own lifecycle.
 *
 * A second what-if implementation is the same defect as a second model version: two
 * places that can disagree about whether unverified, never-committable values are on
 * screen. That is exactly how `shareLink()` came to serialise an active what-if while
 * every sibling I/O function cancelled it first.
 */
describe('what-if exists ONLY inside ManagedOpenISDProject', () => {
  const MANAGED_DRIVER_FILE = join(UI_SRC, 'logic', 'managedProject.ts');

  /** An IDENTIFIER naming what-if — a declaration, a call, a property. Walking the AST's
   *  Identifier/PrivateIdentifier nodes means comments and string/template literals are never
   *  visited at all, so prose may name the concept freely (that is how it gets discussed and
   *  deleted) with no risk of a false positive from a docstring. */
  const WHATIF_IDENTIFIER = /^\w*[wW]hat[_]?[iI]f\w*$/;
  const SANCTIONED = new Set(['isWhatIfActive', 'beginWhatIf', 'cancelWhatIf']);

  it('no file outside managedProject.ts declares its own what-if state or lifecycle', () => {
    const files = filesUnder(UI_SRC).filter(f => f !== MANAGED_DRIVER_FILE);
    const offences: string[] = [];
    for (const f of files) {
      const source = sourceFileOf(f);
      const found = new Set<string>();
      source.forEachDescendant(node => {
        if (!Node.isIdentifier(node) && !Node.isPrivateIdentifier(node)) return;
        const name = node.getText().replace(/^#/, '');
        if (WHATIF_IDENTIFIER.test(name)) found.add(name);
      });
      // Reading ManagedOpenISDProject's OWN published API is the sanctioned way to ask "is a what-if
      // effective?" — that is what the facade is FOR. Anything else is a second implementation.
      for (const name of found) {
        if (!SANCTIONED.has(name)) offences.push(`${rel(f)}: ${name}`);
      }
    }
    assert.deepEqual(offences, [],
      'What-if is ManagedOpenISDProject\'s concept and nothing else may hold it. Every identifier ' +
      'listed above is a SECOND what-if implementation — its own copy, flag, snapshot, ' +
      'subscription or lifecycle function — living outside the one facade that is allowed to ' +
      'know a what-if exists. Delete it and call ManagedOpenISDProject: beginWhatIf() / cancelWhatIf() ' +
      'to drive the session, isWhatIfActive() to paint the UI. Nothing else.');
  });
});

/**
 * ARCHITECTURE.md §3: `OpenISDDriver` is the app's ONE driver model, and `@openisd/winisd`
 * is "solely a serialisation device". The classic `Driver` ADT (`packages/winisd/src/driver.ts`)
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
      'The classic `Driver` ADT (packages/winisd/src/driver.ts) is the model `OpenISDDriver` ' +
      'REPLACES, and `@openisd/winisd` is a serialisation device only. Every import above is ' +
      'a second, competing driver model inside the application — with its own provenance, ' +
      'derivation and JSON shape, free to disagree with OpenISDDriver about the same driver. ' +
      'Migrate the call site onto ManagedOpenISDProject/OpenISDDriver and delete the import; never ' +
      'fix or extend the condemned class in place.');
  });
});

/**
 * ARCHITECTURE.md §"Approved state stores — there are THREE, and no others".
 *
 * The store holds persistent design state; `ManagedOpenISDProject` holds active/edit/what-if driver
 * state; `ViewState` holds presentation state and the visible URL. EVERY other component is a
 * slave to those three — it reads and writes through them and holds nothing of its own.
 *
 * A local copy of state one of the three already holds is a SECOND ANSWER to the same question,
 * and two answers are free to disagree. That is not a hypothetical: it is how a parallel what-if
 * implementation grew inside the store while `ManagedOpenISDProject` existed beside it.
 */
describe('only the three approved stores hold state', () => {
  const APPROVED = [
    join(UI_SRC, 'logic', 'appState.ts'),
    join(UI_SRC, 'logic', 'managedProject.ts'),
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
      'Only the approved stores may hold state: the store (persistent design), ManagedOpenISDProject ' +
      '(active/edit/what-if driver), PresentationState (presentation, browser-backed), ' +
      'UrlAppState (the URL that encapsulates the app state). Each binding ' +
      'above is a fourth store — module-level, outliving every component, reachable by import, ' +
      'and free to disagree with whichever approved store already answers the same question. ' +
      'Delete it and call the approved store, every time; never cache a copy for convenience.');
  });
});

/**
 * ARCHITECTURE.md §"Approved state stores" and §3: the containment must be TOTAL.
 *
 *     everything  ->  store  ->  ManagedOpenISDProject  ->  OpenISDDriver
 *
 * Each arrow is the ONLY way through. `OpenISDDriver` is private state inside `ManagedOpenISDProject`;
 * `ManagedOpenISDProject` is reached through the store. A single leak makes the whole chain advisory:
 * one caller holding the driver directly can mutate it with no notification and no what-if
 * guard, which is the exact defect this architecture exists to make impossible.
 */
describe('containment is total: store -> ManagedOpenISDProject -> OpenISDDriver', () => {
  const MANAGED = join(UI_SRC, 'logic', 'managedProject.ts');
  const STORE = join(UI_SRC, 'logic', 'appState.ts');

  it('ManagedOpenISDProject never hands an OpenISDDriver out — every public member returns data', () => {
    // AST-driven (ts-morph), not text-pattern: a private-field/method (#name or `private`) is
    // exempt — it cannot be reached from outside the class — but every other method, getter, or
    // arrow-function property whose declared return type names OpenISDDriver is a leak,
    // regardless of indentation or getter-vs-method syntax a regex could miss.
    const localProject = new TsProject({ tsConfigFilePath: join(UI_SRC, '..', 'tsconfig.json'), skipAddingFilesFromTsConfig: true });
    const sf = localProject.addSourceFileAtPath(MANAGED);
    const offences: string[] = [];
    for (const cls of sf.getClasses()) {
      const members = [
        ...cls.getMethods(), ...cls.getGetAccessors(), ...cls.getProperties(),
      ];
      for (const m of members) {
        if (m.hasModifier?.('private') || /^#/.test(m.getName())) continue;
        const type = 'getReturnType' in m ? m.getReturnType() : m.getType();
        if (type.getText().includes('OpenISDDriver')) {
          offences.push(`${m.getName()}() returns ${type.getText()}`);
        }
      }
    }

    assert.deepEqual(offences, [],
      'OpenISDDriver is ManagedOpenISDProject\'s private state (the human\'s ruling: it "sits behind ' +
      'ManagedOpenISDProject as private internal state MAPPED to the openisd.yml file"). A public ' +
      'member returning one hands the internal driver to the caller, who can then mutate it ' +
      'behind the facade with no notification and no what-if cancellation. Return the DATA the ' +
      'caller needs — a Cell, a record, an engine driver — never the object.');
  });

  it('the store is the only logic module that holds the ManagedOpenISDProject instance', () => {
    const offences = filesUnder(UI_SRC)
      .filter(f => f !== STORE && f !== MANAGED)
      .flatMap(f => valueImportsOf(f)
        .filter(vi => /managedProject(\.js)?$/.test(vi.spec) && vi.names.includes('ManagedOpenISDProject'))
        .map(() => `${rel(f)} imports the ManagedOpenISDProject CLASS`));

    assert.deepEqual(offences, [],
      'The store constructs and holds the one ManagedOpenISDProject; everything else reaches it as ' +
      '`managedProject` from the store. Importing the class elsewhere is how a SECOND driver ' +
      'state appears - two ManagedProjects are two answers to "what is the driver".');
  });

  it('nothing reaches past ManagedOpenISDProject into the model package for a driver value', () => {
    const offences = filesUnder(UI_SRC)
      .filter(f => f !== MANAGED
        && f !== join(UI_SRC, 'logic', 'managedDriver.ts')
        && f !== join(UI_SRC, 'ui', 'components', 'DriverEditorModal.vue'))
      .flatMap(f => valueImportsOf(f)
        .filter(vi => /(^|\/)@openisd\/model(\/|$)/.test(vi.spec))
        .flatMap(vi => vi.names
          .filter(n => n === 'OpenISDDriver' || n === 'ManagedOpenISDProject')
          .map(n => `${rel(f)} imports ${n} as a VALUE from ${vi.spec}`)));

    assert.deepEqual(offences, [],
      'Only the managed layer may name OpenISDDriver as a value: managedProject.ts, and ' +
      'managedDriver.ts for driver file IO not bound to a project (QO78, human ruling ' +
      '2026-08-22 — file IO moves INTO the domain module that owns what it reads/writes). ' +
      'DriverEditorModal.vue carries its own narrow, ruled draft exemption — see the comment ' +
      'at its own construction site. A type-only import is fine — it erases, so it cannot ' +
      'reach the object.');
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

/**
 * Convention: a leading underscore on an exported name (`_Foo`) marks it class-private —
 * an implementation detail of the module that declares it, exported only so that module's own
 * file-io/store collaborators can name it, never for general consumption. TypeScript has no
 * cross-file access modifier for an exported interface, so this gate is the enforcement: it
 * finds every `export ... _Name` declaration under ui/model/winisd `src/`, then asserts that
 * NO OTHER file names `_Name` in an import. Owner-only, no exceptions, no grant mechanism —
 * a file that needs one goes through the owning module's public API instead.
 */
// TESTS ARE EXEMPT from the privacy rules (human ruling, QO68, 2026-08-21: "tests are
// generally exempt from the privacy rule" / "update the test to allow test access to _").
// Every privacy scan set below is built from src/ roots ONLY — a test file may name a
// _-prefixed export or a _-prefixed class member freely. Widening any of these scans to
// test directories would revoke that ruling and needs the human.
const ALL_SRC_FILES = [...filesUnder(UI_SRC), ...filesUnder(MODEL_SRC), ...filesUnder(WINISD_SRC), ...filesUnder(PERSISTENCE_SRC), ...filesUnder(ENGINE_SRC)];
const REPO_ROOT = join(UI_SRC, '..', '..');

/** Every `export interface|type|class|function|const|let _Name` top-level declaration site in
 *  a file. A name declared in two files is itself a violation of "one owner" and is asserted
 *  separately below. */
function declaredExportedPrivateNames(file: string): string[] {
  const source = sourceFileOf(file);
  const names: string[] = [];
  for (const iface of source.getInterfaces()) if (iface.isExported() && iface.getName().startsWith('_')) names.push(iface.getName());
  for (const ta of source.getTypeAliases()) if (ta.isExported() && ta.getName().startsWith('_')) names.push(ta.getName());
  for (const cls of source.getClasses()) { const n = cls.getName(); if (cls.isExported() && n?.startsWith('_')) names.push(n); }
  for (const fn of source.getFunctions()) { const n = fn.getName(); if (fn.isExported() && n?.startsWith('_')) names.push(n); }
  for (const vs of source.getVariableStatements()) {
    if (!vs.isExported()) continue;
    for (const decl of vs.getDeclarations()) if (decl.getName().startsWith('_')) names.push(decl.getName());
  }
  return names;
}

function privateDeclarationSites(files: string[]): Map<string, string[]> {
  const sites = new Map<string, string[]>();
  for (const f of files) {
    for (const name of declaredExportedPrivateNames(f)) {
      sites.set(name, [...(sites.get(name) ?? []), f]);
    }
  }
  return sites;
}

checklistDescribe('leading-underscore exports are class-private — owner-only, no exceptions', () => {
  it('each private name is declared in exactly one file', () => {
    const sites = privateDeclarationSites(ALL_SRC_FILES);
    const offences = [...sites.entries()]
      .filter(([, files]) => files.length > 1)
      .map(([name, files]) => `${name} is declared in ${files.map(f => relative(REPO_ROOT, f)).join(', ')}`);
    assert.deepEqual(offences, []);
  });

  /**
   * Human rulings 2026-08-23, each an (importing file, private name) pair granted HERE, in the
   * gate, in the open — never disguised at the use site behind a widened or renamed type,
   * which the encapsulation rule bans outright.
   *
   * - driverRepo.ts + _OpenISDDriverJson: "If the bundle is genuinely a _Json... object then
   *   just add an exception in the test itself to permit that access. if the bundle IS THAT
   *   OBJECT then of course it deserves that access." `scripts/bundle-drivers.mjs` copies each
   *   canonical record into the artifact verbatim, so `BundleRecord.record` IS one and is
   *   typed as one; it is opened exactly once, through the injected conformance factory.
   */
  const HUMAN_GRANTED: ReadonlyArray<readonly [file: string, name: string]> = [
    ['persistence/src/repos/driverRepo.ts', '_OpenISDDriverJson'],
  ];

  it('no file outside a name\'s declaring file imports it (human-granted pairs excepted)', () => {
    const sites = privateDeclarationSites(ALL_SRC_FILES);
    const offences = ALL_SRC_FILES
      .flatMap(f => [...sites.entries()]
        .filter(([, [owner]]) => f !== owner)
        .filter(([name]) => !HUMAN_GRANTED.some(
          ([gFile, gName]) => gName === name && relative(REPO_ROOT, f) === gFile))
        .flatMap(([name, [owner]]) =>
          namedImportsOf(f, name, /./)
            .map(spec => `${relative(REPO_ROOT, f)} imports ${name} from ${spec} (owned by ${relative(REPO_ROOT, owner)})`)));

    assert.deepEqual(offences, [],
      'A leading underscore marks a name class-private. Every offence above is a file naming ' +
      'a private declaration it does not own — route through the owning module\'s public API ' +
      'instead of naming the private shape directly, or bring the pair to the human for a ' +
      'HUMAN_GRANTED entry above. Only the human adds a pair there.');
  });

  it('every human-granted pair is live — the file still imports the name (stale grants die)', () => {
    const stale = HUMAN_GRANTED.filter(([gFile, gName]) => {
      const abs = ALL_SRC_FILES.find(f => relative(REPO_ROOT, f) === gFile);
      return !abs || namedImportsOf(abs, gName, /./).length === 0;
    }).map(([gFile, gName]) => `${gFile} no longer imports ${gName}`);
    assert.deepEqual(stale, [],
      'A grant for an import that no longer exists is a dormant permission — delete the pair.');
  });
});

/**
 * Loophole in the gate above: it only catches a file NAMING a private `_Name` directly. A
 * function, const, method, getter, or arrow-function property that is declared with a public
 * (non-underscore) name but whose own signature RETURNS or is TYPED AS a private `_Name` hands
 * the private shape to every caller just as effectively — the caller never has to write `_Name`
 * in an import to get hold of it. This gate closes that for BOTH top-level declarations and
 * class members (a class method returning a private type is exactly as invisible to a
 * text-pattern regex anchored on `export function`/`export const` as it is to a caller who
 * never imports the type by name — see BUG_20260818_private_type_return_gate_uses_line_anchored_
 * regex_and_misses_class_methods.md).
 *
 * The check also walks the declared type STRUCTURALLY — generics, `Promise<...>`, arrays,
 * unions/intersections, and inline object-literal member types — so a private name reachable
 * only through `Result<_Name>`, `Promise<_Name>`, `_Name[]`, or `{ ok: true; record: _Name }`
 * is caught exactly as if it had been returned bare.
 */
describe('an export typed as a private _Name must itself be _-prefixed', () => {
  /** Every private `_Name` reachable inside a TypeNode, walking generics, unions/intersections,
   *  arrays, tuples, parenthesised types, and inline object-literal member types. `seen` guards
   *  against infinite recursion on a self-referential type. */
  function typeNodeNames(typeNode: Node, seen: Set<Node> = new Set()): string[] {
    if (seen.has(typeNode)) return [];
    seen.add(typeNode);
    const out: string[] = [];
    if (Node.isTypeReference(typeNode)) {
      out.push(typeNode.getTypeName().getText());
      for (const arg of typeNode.getTypeArguments()) out.push(...typeNodeNames(arg, seen));
    } else if (Node.isUnionTypeNode(typeNode) || Node.isIntersectionTypeNode(typeNode)) {
      for (const t of typeNode.getTypeNodes()) out.push(...typeNodeNames(t, seen));
    } else if (Node.isArrayTypeNode(typeNode)) {
      out.push(...typeNodeNames(typeNode.getElementTypeNode(), seen));
    } else if (Node.isParenthesizedTypeNode(typeNode)) {
      out.push(...typeNodeNames(typeNode.getTypeNode(), seen));
    } else if (Node.isTupleTypeNode(typeNode)) {
      for (const el of typeNode.getElements()) out.push(...typeNodeNames(el, seen));
    } else if (Node.isTypeLiteral(typeNode)) {
      for (const member of typeNode.getMembers()) {
        const propType = member.asKind(SyntaxKind.PropertySignature)?.getTypeNode();
        if (propType) out.push(...typeNodeNames(propType, seen));
      }
    }
    return out;
  }

  it('every exported function/const/class-member returning or typed as a private _Name is itself named _...', () => {
    const sites = privateDeclarationSites(ALL_SRC_FILES);
    const privateNames = new Set(sites.keys());

    const report = (offences: string[], fileRel: string, name: string, hit: string[]) => {
      offences.push(
        `${fileRel} exports '${name}' typed as private ${hit.join(', ')} ` +
        `but '${name}' itself has no leading underscore`);
    };

    /** A private name's own declaring file is its owner and may expose it under a public
     *  accessor name — the same exemption `f !== owner` grants the import-naming gate above. */
    const ownedHere = (f: string, hit: string[]): string[] =>
      hit.filter(n => !(sites.get(n) ?? []).includes(f));

    const offences: string[] = [];
    for (const f of ALL_SRC_FILES) {
      const source = sourceFileOf(f);
      const fileRel = relative(REPO_ROOT, f);

      for (const fn of source.getFunctions()) {
        if (!fn.isExported()) continue;
        const name = fn.getName();
        if (!name || name.startsWith('_')) continue;
        const rt = fn.getReturnTypeNode();
        if (!rt) continue;
        const hit = ownedHere(f, typeNodeNames(rt).filter(n => privateNames.has(n)));
        if (hit.length) report(offences, fileRel, name, hit);
      }

      for (const vs of source.getVariableStatements()) {
        if (!vs.isExported()) continue;
        for (const decl of vs.getDeclarations()) {
          const name = decl.getName();
          if (name.startsWith('_')) continue;
          const tn = decl.getTypeNode();
          if (!tn) continue;
          const hit = ownedHere(f, typeNodeNames(tn).filter(n => privateNames.has(n)));
          if (hit.length) report(offences, fileRel, name, hit);
        }
      }

      for (const cls of source.getClasses()) {
        if (!cls.isExported()) continue;
        const className = cls.getName() ?? '<anonymous>';
        const members = [...cls.getMethods(), ...cls.getGetAccessors(), ...cls.getProperties()];
        for (const m of members) {
          if (m.hasModifier?.(SyntaxKind.PrivateKeyword) || /^#/.test(m.getName())) continue;
          const name = m.getName();
          if (name.startsWith('_')) continue;
          const tn = Node.isMethodDeclaration(m) || Node.isGetAccessorDeclaration(m)
            ? m.getReturnTypeNode()
            : m.getTypeNode();
          if (!tn) continue;
          const hit = ownedHere(f, typeNodeNames(tn).filter(n => privateNames.has(n)));
          if (hit.length) report(offences, fileRel, `${className}.${name}`, hit);
        }
      }
    }

    assert.deepEqual(offences, [],
      'An export whose own return/value type names a private _Name — directly, or nested ' +
      'inside a generic, Promise, array, union, or object-literal type — leaks that private ' +
      'shape to every caller just as a direct import would. Rename the export itself to _Name ' +
      '(or stop returning the private type — return the module\'s public shape instead) so it ' +
      'falls under the PrivateAllow enforcement above.');
  });
});


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
  if (spec.startsWith('@openisd/model')) return 'model';
  if (spec.startsWith('@openisd/persistence')) return 'persistence';
  if (spec.startsWith('@openisd/winisd')) return 'winisd';
  if (spec.startsWith('@openisd/engine')) return 'engine';
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
    'ui/components->ui/logic', 'ui/components->model', 'ui/components->ui/root',
    'ui/logic->model', 'ui/logic->persistence', 'ui/logic->ui/root', 'ui/logic->winisd', 'ui/logic->engine',
    'persistence-repos->model', 'persistence-repos->engine', 'persistence-storage->model',
    'model->winisd', // human-approved 2026-08-23: toWinISDDriver/toWinISDProject/fromWinISDProject
    'winisd->model', // the correct-direction bridge (winisd/src/bridge.ts)
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
    assert.equal(ALLOWED_EDGES.has('ui/components->winisd'), false,
      'an edge nobody ruled legal must be absent from the matrix, proving it is not vacuously permissive');
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
 * every pre-existing `export * from X` site re-exported at baseline time (2026-08-23),
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
  'model/src/index.ts': {
    './openisdRecord.js': ['CrossSourceReading', 'CurveEntry', 'CurvesBlock', 'DQStatus', 'DqKind', 'DqMark', 'DqSeverity', 'Ground', 'QualityBlock', 'Rating', 'Reading', 'SourceRole'],
    './openisdDerive.js': ['OpenISDDerivation', 'deriveOpenISDFields'],
    './openisdDriver.js': ['Cell', 'MetaCell', 'MetaField', 'OpenISDDriver', 'Provenance', 'SpecField', '_BookkeepingField', '_DerivedField', '_OpenISDDriverJson', '_ScrapedField', '_SpecEntry', '_SpecSection', '_Specs', 'driverRecordProblems', 'winningReading'],
    './openisdProject.js': ['AlignmentKind', 'OpenISDBandpass4Alignment', 'OpenISDBox', 'OpenISDEnvironment', 'OpenISDListening', 'OpenISDPassiveRadiatorAlignment', 'OpenISDPassiveRadiatorRef', 'OpenISDProject', 'OpenISDProjectMeta', 'OpenISDSealedAlignment', 'OpenISDSignal', 'OpenISDSimOptions', 'OpenISDSweepRange', 'OpenISDTarget', 'OpenISDVent', 'OpenISDVentedAlignment', 'ProjectFieldId', 'VENT_ARITY', 'WinIsdBType', '_OpenISDProjectJson'],
    './openisdYamlToWdr.js': ['openisdYamlToWdr'],
    './driverType.js': ['Chip', 'DriverType'],
  },
  'winisd/src/index.ts': {
    './winisdBytes.js': ['WINISD_NEWLINE_SENTINEL', 'WinisdDecodedText', 'WinisdEncoding', 'winisdBytesToText', 'winisdTextToBytes'],
    './winisdProject.js': ['WinISDProject'],
    './winisdDriver.js': ['INI_ROWS', 'WdrCell', 'WdrHeader', 'WinISDDriver'],
    './parstate.js': ['CellState', 'PARSTATE_LEN', 'POS_TO_WDRKEY'],
  },
  'engine/src/engine.ts': {
    './types.js': ['BoxType', 'CircuitModel', 'Complex', 'DriverError', 'EngineDriver', 'Filter', 'FilterType', 'IssueLevel', 'MaxCurvesResult', 'Result', 'Solution', 'SweepParams', 'SweepResult', 'Wiring'],
    './constants.js': ['FLAT_MAX_BOOST_DB', 'G_STANDARD', 'P0'],
    './air.js': ['Air', 'AirEnvironment', 'END_CORRECTION', 'GAMMA', 'P_REF_PA', 'RH_REF_PCT', 'T_REF_K', 'airFor', 'moistAirDensity', 'moistAirSoundVelocity', 'saturationVapourPressure', 'waterVapourMoleFraction'],
    './complex.js': ['cAbs', 'cAdd', 'cArg', 'cDiv', 'cInv', 'cMul', 'cPar', 'cScale', 'cSub', 'cTanh', 'cx'],
    './driver.js': ['deriveEngineDriver', 'driverC', 'driverRho', 'hotRe', 'nominalImpedance', 'solveConsistencyGroup', 'withAddedMass'],
    './efficiency.js': ['efficiencyConstant', 'efficiencyFromSpl', 'referenceEfficiency', 'splFromEfficiency', 'splReferenceConstantDb'],
    './consistency.js': ['ConsistencyIssue', 'Q_GROUP_FIELDS', 'checkConsistency', 'isQGroupField', 'qGroupIsIncomplete'],
    './params.js': ['validateParams'],
    './circuit.js': ['portImpedance', 'portLoss', 'solve'],
    './sweep.js': ['classifyFinite', 'classifyFlatClamp', 'classifyMaxFinite', 'groupDelayMs', 'hfPassbandRef', 'maxCurves', 'passbandRef', 'rolloffFreq', 'sweep', 'tfMag', 'unwrap'],
    './alignments.js': ['ebp', 'findImpedancePeak', 'prMassForFp', 'prTuning', 'sealedFc', 'sealedFromQtc', 'tuningFromLength', 'ventLength', 'ventedAlignment'],
    './filters.js': ['applyFilters', 'evalFilter', 'highPass', 'highShelf', 'linkwitz', 'lowPass', 'lowShelf', 'peakingEQ'],
    './formulas.js': ['driveVoltage', 'prCmsFromVas', 'prFs', 'prFsWithMass', 'prMmdFromFs', 'prQms', 'prRmsFromQms', 'prVas'],
    './lossMode.js': ['LossMode', 'SealedParams', 'sealedFscWinisd', 'sealedResonance', 'sealedResonanceWinisd', 'sourceLoadedQts'],
    './dvolRelation.js': ['DvolInputs', 'depthFromDims', 'dvolFromDims', 'magDepthFromDims', 'magnetFromDims'],
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
