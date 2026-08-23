/**
 * A `.vue` component's props and emits carry primitives, view models and callbacks — never a
 * domain object (A9). `packages/model` owns the driver record and the project; a component that
 * accepts one binds the presentation layer to the domain's own shape, so every later change to
 * that shape reaches into template code, and the component can no longer be mounted over a
 * substitute in a test.
 *
 * The check runs through the TYPE, not the spelling. A prop's declared type is resolved and its
 * whole graph walked — type arguments, union and intersection members, array elements, tuple
 * elements (an emit payload is a tuple), and alias targets — then every symbol reached is asked
 * where it is declared. A hit anywhere under `packages/model/src` is the offence. Walking the
 * resolved type rather than the written text is what closes the indirections a name-match misses:
 * a local `type Row = OpenISDDriver` alias, an `OpenISDDriver[]`, an `OpenISDDriver | null`, and
 * a generic parameterised over one all resolve back to the same declaration.
 *
 * A call the gate cannot analyse is an offence in its own right: `defineProps`/`defineEmits`
 * written in the runtime-object form carries no type argument to walk, so it would pass
 * unexamined. Such a call fails the gate rather than being skipped, because a check that goes
 * quiet on the shapes it cannot read reports absence of evidence as evidence of absence.
 *
 * EXEMPTIONS: none. The list below is empty and stays empty — a component that genuinely needs a
 * domain object is a design question for the human, so it is reported as a finding and ruled on,
 * never absorbed by adding a row here.
 */
import { describe, it, vi } from 'vitest';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { Project as TsProject, Node, type SourceFile, type Type } from 'ts-morph';

vi.setConfig({ testTimeout: 120_000 });

const UI_PKG = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PACKAGES = join(UI_PKG, '..');
const REPO_ROOT = join(PACKAGES, '..');
const DOMAIN_ROOT = join(PACKAGES, 'model', 'src');

/** Empty by ruling. A component needing a domain object is a finding for the human. */
const EXEMPT_COMPONENTS: readonly string[] = [];

const COMPONENT_ROOT = join(UI_PKG, 'src');

function vueFilesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  (function walk(current: string) {
    for (const name of readdirSync(current)) {
      const full = join(current, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.vue')) out.push(full);
    }
  })(dir);
  return out;
}

const project = new TsProject({
  tsConfigFilePath: join(UI_PKG, 'tsconfig.json'),
  skipAddingFilesFromTsConfig: true,
});

/** The SFC's `<script>` block as a virtual TS source file beside the component, so its own
 *  relative imports resolve exactly as they do at build time. */
function scriptOf(file: string): SourceFile {
  const raw = readFileSync(file, 'utf8');
  const text = /<script[^>]*>([\s\S]*?)<\/script>/.exec(raw)?.[1] ?? '';
  return project.createSourceFile(`${file}.ts`, text, { overwrite: true });
}

/** Every file a type's graph reaches: the type itself, what it is built from, and what it
 *  aliases. Bounded by a seen-set, since a self-referential type would otherwise recurse
 *  forever. */
function declarationFilesOf(type: Type, seen = new Set<Type>()): Set<string> {
  const files = new Set<string>();
  if (seen.has(type)) return files;
  seen.add(type);

  for (const symbol of [type.getSymbol(), type.getAliasSymbol()]) {
    for (const decl of symbol?.getDeclarations() ?? []) files.add(decl.getSourceFile().getFilePath());
  }

  const element = type.getArrayElementType();
  const parts: Type[] = [
    ...type.getTypeArguments(),
    ...type.getAliasTypeArguments(),
    ...type.getUnionTypes(),
    ...type.getIntersectionTypes(),
    ...(type.isTuple() ? type.getTupleElements() : []),
    ...(element ? [element] : []),
  ];
  for (const part of parts) for (const f of declarationFilesOf(part, seen)) files.add(f);

  return files;
}

/**
 * The detector, pure over a script source file so the demonstration below can drive it with
 * synthetic input. `isDomainFile` decides what counts as the domain.
 */
export function domainTypesInComponentApi(
  script: SourceFile,
  isDomainFile: (path: string) => boolean,
  describePath: (path: string) => string,
): string[] {
  const offences: string[] = [];
  const label = describePath(script.getFilePath());

  for (const call of script.getDescendants()) {
    if (!Node.isCallExpression(call)) continue;
    const callee = call.getExpression().getText();
    if (callee !== 'defineProps' && callee !== 'defineEmits') continue;

    const line = call.getStartLineNumber();
    const typeArg = call.getTypeArguments()[0];
    if (!typeArg) {
      offences.push(
        `${label}:${line} ${callee} declares no type argument, so its shape cannot be checked`);
      continue;
    }

    for (const member of typeArg.getType().getProperties()) {
      const memberType = member.getTypeAtLocation(typeArg);
      const hits = [...declarationFilesOf(memberType)].filter(isDomainFile);
      if (hits.length > 0) {
        offences.push(
          `${label}:${line} ${callee} member '${member.getName()}' carries a domain type ` +
          `declared in ${[...new Set(hits)].map(describePath).join(', ')}`);
      }
    }
  }

  return offences;
}

describe('a component API carries no domain value (A9)', () => {
  it('flags a domain object on a prop, including through an array and an alias', () => {
    const demo = new TsProject({ useInMemoryFileSystem: true });
    demo.createSourceFile('/domain/driver.ts', 'export class OpenISDDriver { fs = 0; }');
    const script = demo.createSourceFile('/ui/Panel.vue.ts', `
      import { OpenISDDriver } from '../domain/driver.js';
      type Row = OpenISDDriver;
      declare function defineProps<T>(): T;
      const props = defineProps<{
        driver: OpenISDDriver;
        rows: Row[];
        maybe: OpenISDDriver | null;
        label: string;
        onPick: (id: string) => void;
      }>();
    `);

    const offences = domainTypesInComponentApi(
      script, p => p.startsWith('/domain/'), p => p);
    const members = offences.map(o => /member '([^']+)'/.exec(o)?.[1]).sort();

    assert.deepEqual(members, ['driver', 'maybe', 'rows'],
      'the direct, aliased-array and unioned forms must all be caught, and the primitive and ' +
      'callback props must not be');
  });

  it('flags a domain object in an emit payload tuple', () => {
    const demo = new TsProject({ useInMemoryFileSystem: true });
    demo.createSourceFile('/domain/driver.ts', 'export class OpenISDDriver { fs = 0; }');
    const script = demo.createSourceFile('/ui/Picker.vue.ts', `
      import { OpenISDDriver } from '../domain/driver.js';
      declare function defineEmits<T>(): T;
      const emit = defineEmits<{ picked: [OpenISDDriver]; closed: [] }>();
    `);

    const offences = domainTypesInComponentApi(
      script, p => p.startsWith('/domain/'), p => p);

    assert.equal(offences.length, 1);
    assert.match(offences[0]!, /member 'picked' carries a domain type/);
  });

  it('flags a defineProps the gate cannot read, rather than passing it', () => {
    const demo = new TsProject({ useInMemoryFileSystem: true });
    const script = demo.createSourceFile('/ui/Runtime.vue.ts', `
      declare function defineProps(shape: unknown): unknown;
      const props = defineProps({ driver: Object });
    `);

    const offences = domainTypesInComponentApi(script, () => true, p => p);

    assert.equal(offences.length, 1);
    assert.match(offences[0]!, /declares no type argument/);
  });

  it('accepts a component whose API is primitives and callbacks', () => {
    const demo = new TsProject({ useInMemoryFileSystem: true });
    demo.createSourceFile('/domain/driver.ts', 'export class OpenISDDriver { fs = 0; }');
    const script = demo.createSourceFile('/ui/Row.vue.ts', `
      declare function defineProps<T>(): T;
      declare function defineEmits<T>(): T;
      const props = defineProps<{ brand: string; fs: number; starred: boolean }>();
      const emit = defineEmits<{ pick: [id: string]; close: [] }>();
    `);

    assert.deepEqual(
      domainTypesInComponentApi(script, p => p.startsWith('/domain/'), p => p), []);
  });

  it('no component in the tree takes or emits a domain value', () => {
    const isDomainFile = (p: string) => p.startsWith(DOMAIN_ROOT + '/');
    const offences: string[] = [];

    for (const f of vueFilesUnder(COMPONENT_ROOT)) {
      const rel = relative(REPO_ROOT, f);
      if (EXEMPT_COMPONENTS.includes(rel)) continue;
      offences.push(...domainTypesInComponentApi(
        scriptOf(f), isDomainFile, p => relative(REPO_ROOT, p)));
    }

    assert.deepEqual(offences, [],
      'A component that accepts a domain object binds the template to the domain\'s own shape ' +
      'and cannot be mounted over a substitute. Pass the primitives the component actually ' +
      'renders, or a view model built for it, and a callback for what it needs to request. ' +
      'A component that genuinely needs the domain object is a design question for the human — ' +
      'report it, do not add an exemption.');
  });
});
