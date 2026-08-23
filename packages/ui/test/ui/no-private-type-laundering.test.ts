/**
 * QO73 (human ruling 2026-08-22: "delete DriverJSON alias and add an arch test using ast to
 * prohibit such aliasing") + behavioral_instructions.md §"ENCAPSULATION IS ABSOLUTE".
 *
 * A layer must not touch another layer's private implementation shape — directly, via an
 * alias that hides the private name from the PrivateAllow gate, or via an erased type that
 * carries the value anonymously. This gate bans the MECHANISMS, AST-shaped:
 *
 *  1. HIDDEN-PRIVATE LAUNDERING — an exported declaration whose RESOLVED type reaches a
 *     `_`-prefixed private type that its own DECLARED text never writes (e.g.
 *     `type DriverJSON = ReturnType<OpenISDDriver['toJsonRecord']>`, which resolves to
 *     `_OpenISDDriverJson` while naming no `_` identifier). A declaration that names the
 *     private type OPENLY is not laundering — the import is visible to the PrivateAllow gate,
 *     which governs it. FIFTEEN declaration forms are covered, each pinned by a case in
 *     `fixtures/laundering-probe.ts.txt`: type aliases, arrow-function consts, INFERRED
 *     returns (no annotation to grep), class methods/accessors/properties, interface methods
 *     AND function-typed properties, heritage clauses, generic defaults, object-literal
 *     consts, namespaces, object-literal return types, callback parameters, and a
 *     MODULE-PRIVATE CARRIER (an interface or a class, declared but never exported in the
 *     file under scan) exposed only through an exported function's return type.
 *
 *  2. ALIAS-OF-ERASED — an exported type alias that resolves to bare `unknown` or `any`
 *     (a channel with the name stripped entirely).
 *
 *  3. `unknown` IN A CHANNEL POSITION — the `unknown` keyword in an exported declaration's
 *     OUTPUT positions: a function/method return type, an interface/class property type, or
 *     an exported variable's type annotation. Parameters are exempt (accepting `unknown` and
 *     narrowing is the SAFE direction), and index-signature subtrees are exempt
 *     (`Record<string, unknown>` / `[k: string]: unknown` is the untrusted-JSON idiom at a
 *     parse boundary, not a smuggling channel — the value there has no shape to hide).
 *
 * ── How a private type is RECOGNISED, and what is NOT covered ──
 * Resolution walks the checker's TYPE GRAPH and reads SYMBOL names — alias symbols, type
 * arguments, union/intersection members, object-type PROPERTIES, and call-signature returns
 * and parameters — not the checker's printed type text, whose alias-vs-expanded rendering is
 * a formatting decision rather than a guarantee.
 *
 * What that does NOT cover, stated plainly so the next reader does not over-trust this gate:
 *   - a private type whose SYMBOL has been erased before the walk sees it — a mapped type
 *     (`{ [K in keyof _Private]: … }`) or a conditional type that resolves to a fresh
 *     anonymous object type. The members survive; the name does not, so there is nothing to
 *     match on. A structurally-identical object type HAND-WRITTEN in place of the private one
 *     is the same case, and is equally invisible.
 *   - the walk is depth-bounded (8) and `seen`-bounded, so a private type buried deeper than
 *     eight structural hops is not reached.
 *   - the scan STARTS from EXPORTED top-level declarations only: a module-private declaration
 *     that no exported declaration ever returns, accepts, or otherwise exposes is never
 *     reached, because nothing carries it across a boundary. A module-private NAMED carrier
 *     that an exported declaration DOES return is not exempt from the walk — it follows such a
 *     carrier's own public properties exactly as it follows an inline object type, because a
 *     local wrapper is not a governed boundary (FORMs 14-15; see `isDeclaredInFile` below).
 * Every form that IS claimed has a probe case; the probe is what makes the claim checkable.
 *
 * Scope: production source only, packages/ui/src (QO68: tests are exempt from privacy rules).
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Project as TsProject, SyntaxKind, Node } from 'ts-morph';
import type { SourceFile, ModuleDeclaration, TypeNode, Type } from 'ts-morph';

const HERE = dirname(fileURLToPath(import.meta.url));
const UI_SRC = join(HERE, '..', '..', 'src');
const PROBE = join(HERE, 'fixtures', 'laundering-probe.ts.txt');

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

/** A `.vue` file's `<script>` block as a virtual TS source file; a `.ts` file as-is. */
const sfCache = new Map<string, SourceFile>();
function sourceFileOf(file: string): SourceFile {
  const cached = sfCache.get(file);
  if (cached) return cached;
  let sf: SourceFile;
  if (file.endsWith('.vue')) {
    const text = readFileSync(file, 'utf8');
    const m = text.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    sf = project.createSourceFile(file + '.__script.ts', m ? m[1] : '', { overwrite: true });
  } else {
    sf = project.addSourceFileAtPath(file);
  }
  sfCache.set(file, sf);
  return sf;
}

function rel(f: string): string { return relative(UI_SRC, f); }

/** Every `_Uppercase` identifier written in `text` — the codebase's private-name convention.
 *  Applied to our OWN declaration source, never to checker output. */
function namesWritten(text: string): Set<string> {
  return new Set(text.match(/\b_[A-Z]\w*/g) ?? []);
}

/**
 * Whether `type` is a NAMED DECLARED TYPE — a class, interface, type alias or enum, i.e. a
 * type with an identity of its own that is governed where it is declared.
 *
 * Everything else is structural plumbing with no name for any gate to police: an inline object
 * type, a function type, and — the case that is easy to get wrong — the type OF A MEMBER, whose
 * symbol is the member's own name (`rec`) rather than `__type`. Guessing from the symbol NAME
 * misses that one; asking what kind of declaration the symbol has does not.
 */
function isNamedDeclaredType(type: Type): boolean {
  const decls = type.getSymbol()?.getDeclarations() ?? [];
  return decls.some(d =>
    Node.isClassDeclaration(d) || Node.isInterfaceDeclaration(d)
    || Node.isTypeAliasDeclaration(d) || Node.isEnumDeclaration(d));
}

/**
 * Whether every declaration of `type`'s symbol lives in `sf` — the file currently under scan.
 *
 * A named type declared SOMEWHERE ELSE (`OpenISDDriver`, `FileEntry`, any domain/public type
 * imported into this file) is governed where IT is declared: following its own public API
 * here would make every holder of a domain object an offender for what that object legitimately
 * exposes, which is exactly what `isNamedDeclaredType` above exists to stop.
 *
 * A named type declared IN THIS FILE is different: it is governed by nothing (only a
 * `_`-prefixed export falls under the PrivateAllow gate at all), and if it is not itself
 * exported, that gate cannot see it either — a local `interface`/`class` wrapper is a WRAPPER,
 * not a cross-package boundary, so treating it as opaque was the hole (bugs/laundering probe
 * FORMs 14-15): an exported function could return one and walk the private shape straight
 * through it.
 */
function isDeclaredInFile(type: Type, sf: SourceFile): boolean {
  const decls = type.getSymbol()?.getDeclarations() ?? [];
  return decls.length > 0 && decls.every(d => d.getSourceFile() === sf);
}

/**
 * A type's PUBLIC properties only. A class that HOLDS private state is doing encapsulation
 * correctly — `ManagedOpenISDProject` holding `_OpenISDProjectJson` behind `#committed` is the
 * design, not a leak. What this gate polices is what CROSSES a boundary, so the walk follows
 * the public surface and stops at the private wall.
 */
function publicPropertiesOf(type: Type) {
  return type.getProperties().filter(sym => {
    if (sym.getName().startsWith('#')) return false;
    return !sym.getDeclarations().some(d =>
      Node.isModifierable(d)
      && d.getModifiers().some(m =>
        m.getKind() === SyntaxKind.PrivateKeyword || m.getKind() === SyntaxKind.ProtectedKeyword));
  });
}

/**
 * Private type names `type` REACHES, by walking the type graph and reading SYMBOL names.
 *
 * Follows every route a value can travel by: alias symbols, type arguments (so `Foo<_Private>`
 * and `Promise<_Private>`/`_Private[]` are caught), union/intersection members, an object
 * type's own PROPERTIES (so `{ rec: _Private }` cannot hide it), and CALL SIGNATURES — both
 * the return type and the parameters, because a callback property typed
 * `(r: _Private) => void` hands the private record OUT to whoever supplies the callback.
 * `seen` bounds the walk against recursive types; `anchor` is the declaration the property
 * types are resolved at.
 *
 * `open` accumulates names OPENLY written by every LOCAL carrier the walk passes through —
 * mutated in place, read by `hidden()` once the walk is done. A named type declared in this
 * file (`FileEntry`, say) is followed into its own properties (see `isDeclaredInFile` above),
 * and if ITS OWN declaration text already names the private type directly, that is not
 * laundering — the name is sitting right there, in this file, for the PrivateAllow gate to
 * govern via this file's own import. Only a private name that is NEVER written anywhere the
 * walk passes through is the laundering QO73 bans.
 */
function privateTypesReached(
  type: Type, anchor: Node, open: Set<string>, seen = new Set<Type>(), depth = 0,
): Set<string> {
  const found = new Set<string>();
  if (depth > 8 || seen.has(type)) return found;
  seen.add(type);

  for (const sym of [type.getSymbol(), type.getAliasSymbol()]) {
    const name = sym?.getName();
    if (name && /^_[A-Z]/.test(name)) found.add(name);
  }
  // Descend into MEMBERS for a type with no declared identity — an inline object type, a
  // function type, or a member's own type — AND for a named type declared IN THE FILE UNDER
  // SCAN: a local `interface`/`class` wrapper is not itself governed anywhere (only a
  // `_`-prefixed EXPORT falls under the PrivateAllow gate at all), so it is a carrier, not a
  // boundary. A named
  // type declared elsewhere (`OpenISDDriver`, `_OpenISDDriverJson`, `FileEntry` from a
  // DIFFERENT file) is recorded above if it is private and otherwise left alone: it IS
  // governed where it is declared, and following its own public API would make every holder
  // of a domain object an offender for what that object legitimately exposes.
  const namedDeclared = isNamedDeclaredType(type);
  const localCarrier = namedDeclared && isDeclaredInFile(type, anchor.getSourceFile());
  if (localCarrier) {
    for (const d of type.getSymbol()?.getDeclarations() ?? []) {
      for (const n of namesWritten(d.getText())) open.add(n);
    }
  }
  const structural = !namedDeclared || localCarrier;
  const signatures = structural ? type.getCallSignatures() : [];
  const sub = [
    ...type.getTypeArguments(),
    ...type.getAliasTypeArguments(),
    ...(type.isUnion() ? type.getUnionTypes() : []),
    ...(type.isIntersection() ? type.getIntersectionTypes() : []),
    ...(structural ? publicPropertiesOf(type).map(p => p.getTypeAtLocation(anchor)) : []),
    ...signatures.map(s => s.getReturnType()),
    ...signatures.flatMap(s => s.getParameters().map(p => p.getTypeAtLocation(anchor))),
  ];
  for (const t of sub) for (const n of privateTypesReached(t, anchor, open, seen, depth + 1)) found.add(n);
  return found;
}

/** Private types `type` reaches that `declaredText` does not openly name — the laundering. */
function hidden(declaredText: string, type: Type, anchor: Node): string[] {
  const open = namesWritten(declaredText);
  const found = privateTypesReached(type, anchor, open);
  return [...found].filter(n => !open.has(n));
}

/** `unknown` keywords inside `typeNode`, excluding parameter and index-signature subtrees. */
function channelUnknowns(typeNode: TypeNode): boolean {
  const kw = typeNode.getDescendantsOfKind(SyntaxKind.UnknownKeyword);
  // `TypeNode` extends `Node`, so a widening annotation is all this needs — no cast.
  const all: Node[] = typeNode.getKind() === SyntaxKind.UnknownKeyword ? [typeNode, ...kw] : kw;
  return all.some(u => {
    for (let a = u.getParent(); a && a !== typeNode.getParent(); a = a.getParent()) {
      if (a.getKind() === SyntaxKind.Parameter) return false;
      if (a.getKind() === SyntaxKind.IndexSignature) return false;
      // `Record<string, unknown>` is the SAME idiom written as a reference rather than an
      // inline `[k: string]: unknown` — the index signature lives in Record's own definition,
      // so it is not in this node's ancestry and has to be recognised here.
      if (Node.isTypeReference(a) && a.getTypeName().getText() === 'Record') return false;
    }
    return true;
  });
}

/**
 * Every hidden-private laundering offence in one source file — across every exported type
 * alias, function, const, class, interface and namespace, the AST kinds the FIFTEEN probe
 * forms above are spellings of. Shared by the ui/src scan and the probe self-test, so the
 * probe exercises the exact traversal that guards production code — never a parallel
 * implementation of it.
 */
function launderingOffencesIn(sf: SourceFile | ModuleDeclaration, label: string): string[] {
  const offences: string[] = [];
  const report = (what: string, names: string[]) => {
    if (names.length) offences.push(`${label}: ${what} resolves to hidden private ${names.join(', ')}`);
  };

  // FORM 1 + FORM 7 — exported type aliases, and their generic parameter DEFAULTS.
  for (const alias of sf.getTypeAliases()) {
    if (!alias.isExported()) continue;
    report(`type ${alias.getName()}`, hidden(alias.getText(), alias.getType(), alias));
    for (const tp of alias.getTypeParameters()) {
      const def = tp.getDefault();
      if (def) report(`type ${alias.getName()}<${tp.getName()} = …>`, hidden(alias.getText(), def.getType(), alias));
    }
  }

  // FORM 3 — exported function declarations, ANNOTATED OR INFERRED (the return type comes off
  // the checker, so deleting an annotation does not defeat this).
  for (const fn of sf.getFunctions()) {
    if (!fn.isExported()) continue;
    report(`${fn.getName() ?? '(anonymous)'}()`, hidden(fn.getText(), fn.getReturnType(), fn));
  }

  // FORM 2 — exported consts: an arrow function's return type, or the value's own type.
  for (const stmt of sf.getVariableStatements()) {
    if (!stmt.isExported()) continue;
    for (const decl of stmt.getDeclarations()) {
      const type = decl.getType();
      const sigs = type.getCallSignatures();
      const target = sigs.length > 0 ? sigs[0].getReturnType() : type;
      report(`const ${decl.getName()}`, hidden(decl.getText(), target, decl));
    }
  }

  // FORM 4 — exported class methods, get accessors and properties.
  for (const cls of sf.getClasses()) {
    if (!cls.isExported()) continue;
    const name = cls.getName() ?? '(anonymous class)';
    for (const m of cls.getMethods()) {
      if (m.hasModifier(SyntaxKind.PrivateKeyword) || m.getName().startsWith('#')) continue;
      report(`${name}.${m.getName()}()`, hidden(m.getText(), m.getReturnType(), m));
    }
    for (const g of cls.getGetAccessors()) {
      if (g.hasModifier(SyntaxKind.PrivateKeyword)) continue;
      report(`${name}.${g.getName()} (getter)`, hidden(g.getText(), g.getReturnType(), g));
    }
    for (const p of cls.getProperties()) {
      if (p.hasModifier(SyntaxKind.PrivateKeyword) || p.getName().startsWith('#')) continue;
      report(`${name}.${p.getName()}`, hidden(p.getText(), p.getType(), p));
    }
  }

  // FORM 5 + FORM 6 — exported interface properties, METHODS, and HERITAGE clauses.
  for (const iface of sf.getInterfaces()) {
    if (!iface.isExported()) continue;
    const name = iface.getName();
    for (const p of iface.getProperties()) {
      report(`${name}.${p.getName()}`, hidden(p.getText(), p.getType(), p));
    }
    for (const m of iface.getMethods()) {
      report(`${name}.${m.getName()}()`, hidden(m.getText(), m.getReturnType(), m));
    }
    for (const base of iface.getBaseTypes()) {
      report(`interface ${name} extends …`, hidden(iface.getHeritageClauses().map(h => h.getText()).join(' '), base, iface));
    }
  }

  // FORM 11 — an exported NAMESPACE is a source file's worth of declarations in a nested
  // scope; without this recursion everything inside one is unscanned.
  for (const mod of sf.getModules()) {
    if (!mod.isExported()) continue;
    offences.push(...launderingOffencesIn(mod, `${label}:${mod.getName()}`));
  }

  return offences;
}

describe('the gate itself detects all fifteen laundering forms (probe fixture)', () => {
  // The probe is loaded as TEXT into the same ts-morph project — it is never compiled with the
  // app (`.ts.txt`), so it cannot be mistaken for production code or trip another gate.
  const probe = project.createSourceFile(
    join(UI_SRC, '__laundering_probe__.ts'), readFileSync(PROBE, 'utf8'), { overwrite: true });
  const offences = launderingOffencesIn(probe, 'probe');
  const flagged = (needle: string) => offences.some(o => o.includes(needle));

  it('FORM 1 — exported type alias over an indirection', () => assert.ok(flagged('type Form1Alias')));
  it('FORM 2 — exported arrow-function const', () => assert.ok(flagged('const form2Arrow')));
  it('FORM 3 — exported function with an INFERRED return type', () => assert.ok(flagged('form3Inferred()')));
  it('FORM 4 — exported class method AND get accessor', () => {
    assert.ok(flagged('Form4Class.method()'), 'class method');
    assert.ok(flagged('Form4Class.accessor (getter)'), 'class get accessor');
  });
  it('FORM 5 — exported interface METHOD (not a property)', () => assert.ok(flagged('Form5Interface.rec()')));
  it('FORM 6 — exported interface heritage clause', () => assert.ok(flagged('interface Form6Heritage extends')));
  it('FORM 7 — exported generic alias DEFAULT type argument', () => assert.ok(flagged('type Form7GenericDefault')));

  // FORMs 8-12 — the private type hides inside a STRUCTURE (an object type's property, or
  // behind a call signature) rather than in a type-argument position, or inside a namespace.
  it('FORM 8 — interface PROPERTY typed as a function returning the private shape', () =>
    assert.ok(flagged('Form8PropertyFn.rec'),
      '`rec: () => T` is the same declaration as FORM 5\'s `rec(): T` in a different spelling — ' +
      'catching one and not the other is the gap that made the gate a false green'));
  it('FORM 9 — exported object-literal const with a method', () => assert.ok(flagged('const form9ObjectLiteral')));
  it('FORM 10 — class PROPERTY holding a function', () => assert.ok(flagged('Form10ClassPropertyFn.rec')));
  it('FORM 11 — declaration inside an exported NAMESPACE', () => assert.ok(flagged('Form11Namespace')));
  it('FORM 12 — arrow const returning an object literal that holds the private shape', () =>
    assert.ok(flagged('const form12ObjectReturn')));

  it('a PARAMETER-only crossing is not flagged — narrowing input is the safe direction', () => {
    // `acceptsRecordProp` is an interface property typed `(r: _Private) => void` — the walk
    // DOES reach it (a callback handed the private record is an outward crossing), so the
    // genuinely-safe case is the standalone function whose parameter accepts one and whose
    // return type reaches nothing private. Asserting the flagged/not-flagged PAIR is what
    // makes this negative real rather than vacuous: both run through the same traversal.
    assert.ok(flagged('Form13CallbackParam.sink'),
      'a callback property that RECEIVES the private record ships it outward — flagged');
    assert.ok(!flagged('acceptsRecord'),
      'a function that merely ACCEPTS one and returns void ships nothing — not flagged');
  });

  it('a public domain type in every position is not flagged', () => {
    assert.ok(!flagged('SafePublic'), 'a public domain type reaches nothing private');
    assert.ok(!flagged('safeReturn'), 'returning the public domain object is the correct shape');
  });

  // FORMS 14-15 — a module-PRIVATE named carrier (declared in the file under scan, never
  // exported itself) walks the private shape through an EXPORTED function's return type. A
  // walk that stops descending into every NAMED declared type — instead of only one governed
  // elsewhere, outside this file — cannot see either: this is a cross-layer crossing (the
  // function IS exported) hiding behind a name the PrivateAllow gate never governs at all.
  it('FORM 14 — private carrier INTERFACE, declared in-file, exported only via a function', () =>
    assert.ok(flagged('form14BypassViaInterface'), 'a local named wrapper is not a governed boundary'));
  it('FORM 15 — private carrier CLASS, declared in-file, exported only via a function', () =>
    assert.ok(flagged('form15BypassViaClass'), 'a class carrier is the same bypass as FORM 14'));
});

/** The index-signature exemption lives in `channelUnknowns`, which the laundering traversal
 *  never calls — so it is exercised HERE, against real type nodes, rather than asserted
 *  through a probe that could not reach it. */
describe('channelUnknowns — the two exemptions are real, and the channel case still fires', () => {
  const sf = project.createSourceFile(join(UI_SRC, '__unknown_probe__.ts'), `
    export interface Probe {
      indexed: Record<string, unknown>;
      inline: { [k: string]: unknown };
      channel: unknown;
      nested: { held: unknown };
    }
    export function takesUnknown(_x: unknown): void {}
    export function returnsUnknown(): unknown { return 1; }
  `, { overwrite: true });
  const iface = sf.getInterfaceOrThrow('Probe');
  const typeNodeOf = (name: string) => iface.getPropertyOrThrow(name).getTypeNodeOrThrow();

  it('Record<string, unknown> and an inline index signature are EXEMPT', () => {
    assert.equal(channelUnknowns(typeNodeOf('indexed')), false, 'the untrusted-JSON idiom');
    assert.equal(channelUnknowns(typeNodeOf('inline')), false, 'the same idiom, written inline');
  });

  it('a bare `unknown` property, and one nested in an object type, ARE channels', () => {
    assert.equal(channelUnknowns(typeNodeOf('channel')), true);
    assert.equal(channelUnknowns(typeNodeOf('nested')), true);
  });

  it('a PARAMETER of unknown is exempt while a RETURN of unknown is not', () => {
    const param = sf.getFunctionOrThrow('takesUnknown').getParameters()[0].getTypeNodeOrThrow();
    assert.equal(channelUnknowns(param), true,
      'called on the parameter\'s own type node the keyword IS the node — the exemption is ' +
      'positional, applied by the caller below, which is what the scan tests actually do');
    assert.equal(channelUnknowns(sf.getFunctionOrThrow('returnsUnknown').getReturnTypeNodeOrThrow()), true);
  });
});

describe('no private-type laundering (QO73) — packages/ui/src', () => {
  const files = filesUnder(UI_SRC);

  // Explicit timeout: this test RESOLVES types through the checker across every ui/src file,
  // which is seconds of work alone and slower still under a fully loaded parallel run — the
  // same load pattern that produced false-fail timeouts on the sibling architecture gate
  // before it got its own budget.
  it('no exported declaration hides a private _Name behind type indirection', { timeout: 120_000 }, () => {
    const offences = files.flatMap(f => launderingOffencesIn(sourceFileOf(f), rel(f)));

    assert.deepEqual(offences, [],
      'A declaration that RESOLVES to a private _Name without WRITING it is the laundering ' +
      'QO73 bans: the PrivateAllow gate cannot see a name that is never imported. Either name ' +
      'the private type openly (and let the PrivateAllow gate govern it, owner-only) or, ' +
      'better, redesign so the private shape does not cross the boundary at all — a real API ' +
      'on the owning object, ' +
      'answering the question the caller actually has.');
  });

  it('no exported type alias resolves to bare unknown/any', () => {
    const offences: string[] = [];
    for (const f of files) {
      for (const alias of sourceFileOf(f).getTypeAliases()) {
        if (!alias.isExported()) continue;
        const resolved = alias.getType().getText(alias).trim();
        if (resolved === 'unknown' || resolved === 'any') {
          offences.push(`${rel(f)}: type ${alias.getName()} = ${resolved}`);
        }
      }
    }
    assert.deepEqual(offences, [],
      'An exported alias OF an erased type is a value channel with the name stripped — ' +
      'the widest possible laundering. Type the value honestly or do not export the channel.');
  });

  it('no `unknown` in an exported channel position (returns, properties, variable annotations)', () => {
    const offences: string[] = [];
    for (const f of files) {
      const sf = sourceFileOf(f);
      for (const fn of sf.getFunctions()) {
        if (!fn.isExported()) continue;
        const tn = fn.getReturnTypeNode();
        if (tn && channelUnknowns(tn)) offences.push(`${rel(f)}: ${fn.getName() ?? '(anonymous)'}() return type carries unknown`);
      }
      for (const iface of sf.getInterfaces()) {
        if (!iface.isExported()) continue;
        for (const prop of iface.getProperties()) {
          const tn = prop.getTypeNode();
          if (tn && channelUnknowns(tn)) offences.push(`${rel(f)}: ${iface.getName()}.${prop.getName()} typed unknown`);
        }
        for (const method of iface.getMethods()) {
          const tn = method.getReturnTypeNode();
          if (tn && channelUnknowns(tn)) offences.push(`${rel(f)}: ${iface.getName()}.${method.getName()}() return type carries unknown`);
        }
      }
      for (const cls of sf.getClasses()) {
        if (!cls.isExported()) continue;
        for (const prop of cls.getProperties()) {
          const tn = prop.getTypeNode();
          if (tn && channelUnknowns(tn)) offences.push(`${rel(f)}: ${cls.getName()}.${prop.getName()} typed unknown`);
        }
        for (const m of cls.getMethods()) {
          const tn = m.getReturnTypeNode();
          if (tn && channelUnknowns(tn)) offences.push(`${rel(f)}: ${cls.getName()}.${m.getName()}() return type carries unknown`);
        }
      }
      for (const stmt of sf.getVariableStatements()) {
        if (!stmt.isExported()) continue;
        for (const decl of stmt.getDeclarations()) {
          const tn = decl.getTypeNode();
          if (tn && channelUnknowns(tn)) offences.push(`${rel(f)}: const ${decl.getName()} typed unknown`);
        }
      }
    }
    assert.deepEqual(offences, [],
      '`unknown` in an OUTPUT position ships a value whose shape no gate can inspect — if ' +
      'the value is private, that is the erased-channel form of the QO73 laundering; if it ' +
      'is not private, it can be typed honestly. Parameters (narrowing input) and index ' +
      'signatures (untrusted-JSON boundaries) are the two legitimate uses, and are exempt.');
  });
});
