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

/** Every module specifier the file imports from — the structural fact, not the prose. */
function importsOf(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const specs: string[] = [];
  const re = /\bfrom\s+['"]([^'"]+)['"]/g;
  for (let m = re.exec(text); m; m = re.exec(text)) specs.push(m[1]);
  const bare = /\bimport\s+['"]([^'"]+)['"]/g;
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

  it('the presentation layer reaches services only through logic', () => {
    const offences = filesUnder(join(UI_SRC, 'ui')).flatMap(f =>
      importsOf(f)
        .filter(s => layerOf(s) === 'service')
        .map(s => `${rel(f)} imports ${s}`));

    assert.deepEqual(offences, [],
      'ui depends on logic and nothing else. Reaching past it into a service skips a layer.');
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
