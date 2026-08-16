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
 * declaration — never prose. A gate that fails because a comment mentions a module name is a
 * broken gate: it manufactures false positives, and the usual "fix" is a rename that changes
 * no behaviour and destroys the evidence.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

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

/**
 * Every module specifier a VALUE import pulls in. `import type` erases at compile time —
 * it creates no runtime edge, so it cannot make one file depend on another's behaviour. Every
 * assertion in this file reasons about runtime dependency, so every one of them must ignore a
 * type-only import; a gate that flags one is flagging nothing.
 */
function importsOf(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const specs: string[] = [];

  const valueImport = /^\s*import\s+(type\s+)?([^;]*?)\s*from\s+['"]([^'"]+)['"]/gm;
  for (let m = valueImport.exec(text); m; m = valueImport.exec(text)) {
    const [, isTypeOnly, bindings, spec] = m;
    if (isTypeOnly) continue;
    // `import { type X, Y }` erases X but not Y — only a real binding left after stripping
    // `type <name>,` inside the braces counts as a value import.
    const stripped = bindings.replace(/\{[^}]*\}/g, b => b.replace(/\btype\s+\w+,?/g, ''));
    if (/\w/.test(stripped.replace(/[{},\s]/g, ''))) specs.push(spec);
  }

  // A bare `import '...'` has no bindings to erase — it runs the module for its side effects.
  const bare = /^\s*import\s+['"]([^'"]+)['"]/gm;
  for (let m = bare.exec(text); m; m = bare.exec(text)) specs.push(m[1]);

  return specs;
}

/** Which layer a specifier resolves into, judged from the path it names. */
function layerOf(spec: string): 'ui' | 'logic' | 'service' | 'domain' | 'external' {
  if (/(^|\/)(db)\//.test(spec) || /(^|\/)(diagnostics|logging)\//.test(spec)) return 'service';
  if (/(^|\/)logic\//.test(spec)) return 'logic';
  if (/(^|\/)ui\//.test(spec) || spec.endsWith('.vue')) return 'ui';
  if (spec.startsWith('@openisd/')) return 'domain';
  return 'external';
}

/**
 * Every VALUE import statement in a file, as (module specifier, bound names) pairs — a finer
 * grain than `importsOf()`, which only needs the specifier. Reuses the same type-only-import
 * erasure rule: `import type` and a `type X` inside `{ }` bind no runtime name.
 */
function valueImportsOf(file: string): { spec: string; names: string[] }[] {
  const text = readFileSync(file, 'utf8');
  const out: { spec: string; names: string[] }[] = [];
  const valueImport = /^\s*import\s+(type\s+)?([^;]*?)\s*from\s+['"]([^'"]+)['"]/gm;
  for (let m = valueImport.exec(text); m; m = valueImport.exec(text)) {
    const [, isTypeOnly, bindings, spec] = m;
    if (isTypeOnly) continue;
    const stripped = bindings.replace(/\{[^}]*\}/g, b => b.replace(/\btype\s+\w+,?/g, ''));
    const names = Array.from(stripped.matchAll(/[A-Za-z_$][\w$]*/g))
      .map(x => x[0])
      .filter(n => n !== 'as' && n !== 'default');
    if (names.length) out.push({ spec, names });
  }
  return out;
}

const rel = (f: string) => relative(UI_SRC, f);

describe('layering — every arrow points downward', () => {
  it('a service never imports the application state or the logic layer', () => {
    const services = [join(UI_SRC, 'db'), join(UI_SRC, 'diagnostics'), join(UI_SRC, 'logging')]
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
    const groups = { db: join(UI_SRC, 'db'), diagnostics: join(UI_SRC, 'diagnostics'), logging: join(UI_SRC, 'logging') };
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
    const files = [join(UI_SRC, 'logic'), join(UI_SRC, 'db'), join(UI_SRC, 'diagnostics'), join(UI_SRC, 'logging')]
      .flatMap(filesUnder);
    const offences = files.flatMap(f =>
      importsOf(f).filter(s => s.endsWith('.vue')).map(s => `${rel(f)} imports ${s}`));

    assert.deepEqual(offences, [], 'Below presentation, nothing knows a component exists.');
  });
});

describe('inversion of control — collaborators are injected, never reached for', () => {
  /** A module-level `let`/`var` that is exported is shared mutable state by another name. */
  const EXPORTED_MUTABLE = /^export\s+(let|var)\s+(\w+)/gm;
  /** A ready-made instance exported from the module IS the global — the importer cannot
   *  substitute one, so nothing that depends on it can be tested in isolation. */
  const EXPORTED_SINGLETON = /^export\s+const\s+(\w+)\s*=\s*(new\s+\w+|reactive\(|ref\()/gm;

  const CONSTRUCTED = [join(UI_SRC, 'db'), join(UI_SRC, 'diagnostics'), join(UI_SRC, 'logging')];

  it('a service exports no mutable module-level binding', () => {
    const offences: string[] = [];
    for (const f of CONSTRUCTED.flatMap(filesUnder)) {
      const text = readFileSync(f, 'utf8');
      for (const m of text.matchAll(EXPORTED_MUTABLE)) offences.push(`${rel(f)}: export ${m[1]} ${m[2]}`);
    }
    assert.deepEqual(offences, [],
      'Exported mutable bindings are globals. State belongs to the layer that owns it, ' +
      'reached through a value the caller passed in.');
  });

  it('a service exports no pre-built instance — it exports a factory the caller wires', () => {
    const offences: string[] = [];
    for (const f of CONSTRUCTED.flatMap(filesUnder)) {
      const text = readFileSync(f, 'utf8');
      for (const m of text.matchAll(EXPORTED_SINGLETON)) offences.push(`${rel(f)}: export const ${m[1]} = ${m[2]}…`);
    }
    assert.deepEqual(offences, [],
      'Export a create*() factory taking its collaborators as arguments. A module-level ' +
      'instance cannot be substituted, so every consumer becomes untestable in isolation.');
  });

  it('every service module offers a create*() factory', () => {
    const FACTORY = /^export\s+function\s+create[A-Z]\w*\s*\(/m;
    const missing: string[] = [];
    for (const dir of CONSTRUCTED) {
      const modules = filesUnder(dir).filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts'));
      for (const f of modules) {
        const text = readFileSync(f, 'utf8');
        // A module that exports nothing callable is a type or constant module — nothing to wire.
        if (!/^export\s+(function|class)\s/m.test(text)) continue;
        if (!FACTORY.test(text)) missing.push(rel(f));
      }
    }
    assert.deepEqual(missing, [],
      'One consistent construction pattern: create<Name>(deps) returns the service. ' +
      'Consumers receive it; they never import a ready-made one.');
  });
});

/**
 * ARCHITECTURE.md §3 "`ManagedProject` — the one facade over every state layer", and the
 * dependency-rules table (§2): only `ManagedProject` reaches `OpenISDProject`, and only
 * `OpenISDProject` reaches its members — the driver, the radiator, the box, the vent.
 * Everything else goes through the facade alone.
 */
describe('ManagedProject is the only holder of OpenISDDriver', () => {
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

  it('the draft exemption names a file that still exists and still holds a draft', () => {
    const text = readFileSync(DRAFT_HOLDER, 'utf8');
    assert.match(text, /OpenISDDriver\.fromRecord\(/,
      'DriverEditorModal.vue no longer holds a live draft — delete this exemption rather than ' +
      'leaving a hole in the containment rule for the next file to fall through.');
  });

  it('nothing outside managedProject.ts imports the OpenISDDriver value', () => {
    const files = filesUnder(UI_SRC).filter(f => f !== MANAGED_DRIVER_FILE && f !== DRAFT_HOLDER);
    const offences = files.flatMap(f =>
      valueImportsOf(f)
        .filter(vi => /(^|\/)@openisd\/model(\/|$)/.test(vi.spec) && vi.names.includes('OpenISDDriver'))
        .map(vi => `${rel(f)} imports OpenISDDriver from ${vi.spec}`));

    assert.deepEqual(offences, [],
      '`ManagedProject` (packages/ui/src/logic/managedProject.ts) is the ONLY facade over a ' +
      "driver's ground/modified/edit-or-whatif state. A second import of the OpenISDDriver " +
      'class is a second, uncontrolled path into that state — it bypasses the edit/what-if ' +
      'overlay, the single-channel notification asymmetry, and the what-if-never-leaks ' +
      'cancellation guard `ManagedProject` exists to enforce.');
  });

  it('managedProject.ts itself is the one file that constructs an OpenISDDriver', () => {
    const text = readFileSync(MANAGED_DRIVER_FILE, 'utf8');
    assert.match(text, /OpenISDDriver\.fromRecord\(/,
      'managedProject.ts no longer constructs an OpenISDDriver — either the facade was ' +
      'gutted, or construction moved to a helper file the previous assertion also needs to ' +
      'exempt. Update both together, never widen the exemption alone.');
  });
});

/**
 * ARCHITECTURE.md §3: `ManagedProject` wraps ground state, committed state, and an
 * edit-or-what-if overlay, and NOTHING outside it may hold, name, or reason about a
 * what-if. A component asks `ManagedProject` whether a what-if is effective; it never
 * keeps its own flag, its own copy, or its own lifecycle.
 *
 * A second what-if implementation is the same defect as a second model version: two
 * places that can disagree about whether unverified, never-committable values are on
 * screen. That is exactly how `shareLink()` came to serialise an active what-if while
 * every sibling I/O function cancelled it first.
 */
describe('what-if exists ONLY inside ManagedProject', () => {
  const MANAGED_DRIVER_FILE = join(UI_SRC, 'logic', 'managedProject.ts');

  /** An IDENTIFIER naming what-if — a declaration, a call, a property. Never a comment or a
   *  string: prose may name the concept freely (that is how it gets discussed and deleted),
   *  and a gate that fails on a docstring manufactures false positives whose usual "fix" is
   *  a rename that changes no behaviour. Matched on code with comments stripped. */
  const WHATIF_IDENTIFIER = /\b\w*[wW]hat[_]?[iI]f\w*\b/g;

  /** Source with line comments, block comments and string/template literals removed, so only
   *  real identifiers remain. Crude but sufficient: it never has to round-trip, only to stop
   *  prose from reaching the matcher. */
  function codeOnly(text: string): string {
    return text
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/[^\n]*/g, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''")
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/`(?:[^`\\]|\\.)*`/g, '``');
  }

  it('no file outside managedProject.ts declares its own what-if state or lifecycle', () => {
    const files = filesUnder(UI_SRC).filter(f => f !== MANAGED_DRIVER_FILE);
    const offences: string[] = [];
    for (const f of files) {
      const found = new Set(codeOnly(readFileSync(f, 'utf8')).match(WHATIF_IDENTIFIER) ?? []);
      // Reading ManagedProject's OWN published API is the sanctioned way to ask "is a what-if
      // effective?" — that is what the facade is FOR. Anything else is a second implementation.
      const SANCTIONED = new Set(['isWhatIfActive', 'beginWhatIf', 'cancelWhatIf']);
      for (const name of found) {
        if (!SANCTIONED.has(name)) offences.push(`${rel(f)}: ${name}`);
      }
    }
    assert.deepEqual(offences, [],
      'What-if is ManagedProject\'s concept and nothing else may hold it. Every identifier ' +
      'listed above is a SECOND what-if implementation — its own copy, flag, snapshot, ' +
      'subscription or lifecycle function — living outside the one facade that is allowed to ' +
      'know a what-if exists. Delete it and call ManagedProject: beginWhatIf() / cancelWhatIf() ' +
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
      'Migrate the call site onto ManagedProject/OpenISDDriver and delete the import; never ' +
      'fix or extend the condemned class in place.');
  });
});

/**
 * ARCHITECTURE.md §"Approved state stores — there are THREE, and no others".
 *
 * The store holds persistent design state; `ManagedProject` holds active/edit/what-if driver
 * state; `ViewState` holds presentation state and the visible URL. EVERY other component is a
 * slave to those three — it reads and writes through them and holds nothing of its own.
 *
 * A local copy of state one of the three already holds is a SECOND ANSWER to the same question,
 * and two answers are free to disagree. That is not a hypothetical: it is how a parallel what-if
 * implementation grew inside the store while `ManagedProject` existed beside it.
 */
describe('only the three approved stores hold state', () => {
  const APPROVED = [
    join(UI_SRC, 'logic', 'store.ts'),
    join(UI_SRC, 'logic', 'managedProject.ts'),
    join(UI_SRC, 'logic', 'presentationState.ts'),   // not built yet — see ARCHITECTURE.md
    join(UI_SRC, 'logic', 'urlAppState.ts'),         // not built yet — see ARCHITECTURE.md
  ];

  /** A module-level reactive container — `ref()`, `shallowRef()`, `reactive()` — assigned to a
   *  module-scope binding. Inside a component's `setup`/`<script setup>` these are indented;
   *  a MODULE-level one (column 0) outlives every component and IS a store by another name. */
  const MODULE_LEVEL_REACTIVE =
    /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::[^=]+)?=\s*(ref|shallowRef|reactive|shallowReactive)\s*[(<]/gm;

  it('no module outside the approved stores holds module-level reactive state', () => {
    const files = filesUnder(UI_SRC)
      .filter(f => f.endsWith('.ts'))
      .filter(f => !APPROVED.includes(f));

    const offences: string[] = [];
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      for (const m of text.matchAll(MODULE_LEVEL_REACTIVE)) {
        offences.push(`${rel(f)}: ${m[2]} ${m[1]}`);
      }
    }

    assert.deepEqual(offences, [],
      'Only the approved stores may hold state: the store (persistent design), ManagedProject ' +
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
 *     everything  ->  store  ->  ManagedProject  ->  OpenISDDriver
 *
 * Each arrow is the ONLY way through. `OpenISDDriver` is private state inside `ManagedProject`;
 * `ManagedProject` is reached through the store. A single leak makes the whole chain advisory:
 * one caller holding the driver directly can mutate it with no notification and no what-if
 * guard, which is the exact defect this architecture exists to make impossible.
 */
describe('containment is total: store -> ManagedProject -> OpenISDDriver', () => {
  const MANAGED = join(UI_SRC, 'logic', 'managedProject.ts');
  const STORE = join(UI_SRC, 'logic', 'store.ts');

  it('ManagedProject never hands an OpenISDDriver out — every public member returns data', () => {
    const text = readFileSync(MANAGED, 'utf8');
    // A member whose declared return type is the internal driver. Private members (#name) are
    // exempt by definition: they cannot be reached from outside the class.
    const LEAKS = /^\s{2}(?!#)(?:static\s+)?(\w+)\s*\([^)]*\)\s*:\s*OpenISDDriver\b/gm;
    const offences = Array.from(text.matchAll(LEAKS)).map(m => `${m[1]}() returns OpenISDDriver`);

    assert.deepEqual(offences, [],
      'OpenISDDriver is ManagedProject\'s private state (the human\'s ruling: it "sits behind ' +
      'ManagedProject as private internal state MAPPED to the openisd.yml file"). A public ' +
      'member returning one hands the internal driver to the caller, who can then mutate it ' +
      'behind the facade with no notification and no what-if cancellation. Return the DATA the ' +
      'caller needs — a Cell, a record, an engine driver — never the object.');
  });

  it('the store is the only logic module that holds the ManagedProject instance', () => {
    const offences = filesUnder(UI_SRC)
      .filter(f => f !== STORE && f !== MANAGED)
      .flatMap(f => valueImportsOf(f)
        .filter(vi => /managedProject(\.js)?$/.test(vi.spec) && vi.names.includes('ManagedProject'))
        .map(() => `${rel(f)} imports the ManagedProject CLASS`));

    assert.deepEqual(offences, [],
      'The store constructs and holds the one ManagedProject; everything else reaches it as ' +
      '`managedProject` from the store. Importing the class elsewhere is how a SECOND driver ' +
      'state appears - two ManagedProjects are two answers to "what is the driver".');
  });

  it('nothing reaches past ManagedProject into the model package for a driver value', () => {
    const offences = filesUnder(UI_SRC)
      .filter(f => f !== MANAGED && f !== join(UI_SRC, 'ui', 'components', 'DriverEditorModal.vue'))
      .flatMap(f => valueImportsOf(f)
        .filter(vi => /(^|\/)@openisd\/model(\/|$)/.test(vi.spec))
        .flatMap(vi => vi.names
          .filter(n => n === 'OpenISDDriver' || n === 'ManagedProject')
          .map(n => `${rel(f)} imports ${n} as a VALUE from ${vi.spec}`)));

    assert.deepEqual(offences, [],
      'Only managedProject.ts may name OpenISDDriver as a value. A type-only import is fine — ' +
      'it erases, so it cannot reach the object.');
  });
});
