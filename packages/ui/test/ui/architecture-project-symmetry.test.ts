/**
 * Lane P's symmetry gate (docs/design/PROJECT_DOMAIN_SYMMETRY.md P5).
 *
 * Two invariants, both matched on the AST, never on prose:
 *
 * 1. `openisdProject.ts` exports NO free functions. A question about a project's state is a
 *    method on the object that owns it — a new exported function is the getter problem coming
 *    back under a different spelling. ONE sunset exemption: the `prCmsFromWinIsdVas` trio,
 *    whose only consumer (`prWinIsdFields.ts`) is P4's held restructure; the trio and this
 *    exemption are deleted together with P4.
 *
 * 2. No UI code outside `managedProject.ts` touches the entered set (`target.entered`,
 *    `isEntered(`, `setEntered(`). Without entered-state access no UI code CAN derive a
 *    field's provenance on its own, so every E/C/N the UI shows necessarily resolves through
 *    a `ManagedProject` accessor — one flat provenance getter per field
 *    (`boxVolumeProvenance()`, `ventDiameterProvenance()`, `prFpProvenance()`, …) for vent/PR-
 *    group fields, a named getter for everything else. `ManagedProject` has no keyed
 *    dispatch at all — `docs/design/ENCAPSULATION_AND_LAYERING.md` — but the invariant this test
 *    enforces is the same: no route around the domain object's own provenance. The demo fixture
 *    below still names `projectCell` as a stand-in shape purely to exercise the detector — it is
 *    not asserting anything about real `ManagedProject`, which has no such method.
 */
import { describe, it, vi } from 'vitest';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { Project as TsProject, Node, type SourceFile } from 'ts-morph';

vi.setConfig({ testTimeout: 60_000 });

const UI_PKG = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPO_ROOT = join(UI_PKG, '..', '..');
const OPENISD_PROJECT_TS = join(REPO_ROOT, 'packages', 'model', 'src', 'openisdProject.ts');

const project = new TsProject({
  tsConfigFilePath: join(UI_PKG, 'tsconfig.json'),
  skipAddingFilesFromTsConfig: true,
});

/** Exported free-function names in a source file — declarations and exported consts whose
 *  initialiser is a function. */
function exportedFreeFunctions(source: SourceFile): string[] {
  const names: string[] = [];
  for (const fn of source.getFunctions()) {
    if (fn.isExported() && fn.getName()) names.push(fn.getName()!);
  }
  for (const v of source.getVariableStatements()) {
    if (!v.isExported()) continue;
    for (const d of v.getDeclarations()) {
      const init = d.getInitializer();
      if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
        names.push(d.getName());
      }
    }
  }
  return names.sort();
}

/** Entered-state touches in a source file: `target.entered` property chains and
 *  `isEntered(`/`setEntered(` call names. */
function enteredStateTouches(source: SourceFile): string[] {
  const hits: string[] = [];
  for (const node of source.getDescendants()) {
    if (Node.isPropertyAccessExpression(node) && node.getName() === 'entered') {
      const target = node.getExpression();
      // property-access base (x.target.entered) AND identifier base (target.entered on a
      // destructured local) — the destructure would otherwise slip the gate
      if ((Node.isPropertyAccessExpression(target) && target.getName() === 'target')
        || (Node.isIdentifier(target) && target.getText() === 'target')) {
        hits.push(`${node.getStartLineNumber()}: ${node.getText().slice(0, 60)}`);
      }
    }
    if (Node.isCallExpression(node)) {
      const callee = node.getExpression();
      if (Node.isPropertyAccessExpression(callee)
        && (callee.getName() === 'isEntered' || callee.getName() === 'setEntered')) {
        hits.push(`${node.getStartLineNumber()}: ${node.getText().slice(0, 60)}`);
      }
    }
  }
  return hits;
}

describe('project symmetry — the gate can fail (non-vacuous demonstrations)', () => {
  it('flags an exported free function and passes a method', () => {
    const demo = new TsProject({ useInMemoryFileSystem: true });
    const bad = demo.createSourceFile('/a.ts',
      'export function boxVolume(box: object): number { return 0; }\n'
      + 'export const readIt = (b: object): number => 1;\n'
      + 'export class C { volume(): number { return 0; } }\n');
    assert.deepEqual(exportedFreeFunctions(bad), ['boxVolume', 'readIt']);
    const good = demo.createSourceFile('/b.ts', 'export class C { volume(): number { return 0; } }\n');
    assert.deepEqual(exportedFreeFunctions(good), []);
  });

  it('flags an entered-state touch and passes a projectCell read', () => {
    const demo = new TsProject({ useInMemoryFileSystem: true });
    const bad = demo.createSourceFile('/a.ts',
      'declare const p: { target: { entered: Record<string, true> } };\n'
      + 'declare const mp: { isEntered(f: string): boolean };\n'
      + 'export const x = p.target.entered["Fb"];\n'
      + 'export const y = mp.isEntered("Fb");\n');
    assert.equal(enteredStateTouches(bad).length, 2);
    const good = demo.createSourceFile('/b.ts',
      'declare const mp: { projectCell(f: string): { state: string } };\n'
      + 'export const s = mp.projectCell("Fb").state;\n');
    assert.deepEqual(enteredStateTouches(good), []);
  });
});

describe('project symmetry — the invariants hold (Lane P5)', () => {
  it('openisdProject.ts exports no free functions — none, no exemptions', () => {
    const source = project.addSourceFileAtPath(OPENISD_PROJECT_TS);
    assert.deepEqual(exportedFreeFunctions(source), [],
      'A question about a project\'s state is a METHOD on OpenISDProject (or its alignment '
      + 'surface), never a free function operating on the record from outside — that is the '
      + 'retired getter coming back under another spelling. Move the logic onto the class.');
  });

  it('no UI code outside managedProject.ts touches the entered set', () => {
    const SRC = join(UI_PKG, 'src');
    const offences: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) { walk(full); continue; }
        if (!name.endsWith('.ts') && !name.endsWith('.vue')) continue;
        if (full.endsWith('logic/managedProject.ts')) continue; // the ONE licensed home
        const raw = readFileSync(full, 'utf8');
        // EVERY script block, not just the first — a .vue file may carry both a setup and a
        // plain script block, and a gate that reads one is blind to the other.
        const text = name.endsWith('.vue')
          ? [...raw.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n')
          : raw;
        const sf = project.createSourceFile(`${full}.gate.ts`, text, { overwrite: true });
        for (const hit of enteredStateTouches(sf)) {
          offences.push(`${relative(REPO_ROOT, full)}:${hit}`);
        }
      }
    };
    if (existsSync(SRC)) walk(SRC);
    assert.deepEqual(offences, [],
      'Provenance is the domain object\'s answer. UI code reading or writing the entered set '
      + 'is deriving E/C/N on its own — route through a ManagedProject accessor instead '
      + '(a flat provenance getter per field — boxVolumeProvenance(), ventDiameterProvenance(), '
      + 'prFpProvenance(), etc — or a named getter).');
  });
});
