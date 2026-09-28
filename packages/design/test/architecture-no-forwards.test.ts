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
 * NO FORWARDING FUNCTIONS. A function or method whose whole body is `return g(<its own
 * parameters, unchanged, in order>)` adds a name and nothing else. John, 2026-09-28, on
 * `Engine.updatePassFilter` → `filters.ts updatePassFilter` → `PassFilter.with`, three layers
 * for one clamp: "all this useless wrapping … disappointingly crap". The standing rule
 * (`~/.claude/CLAUDE.md`, "No convenience wrapping") already banned it; nothing checked.
 *
 * A wrapper earns its place by reshaping the call — validating, defaulting, translating an
 * error, adding or dropping an argument, storing the result. Passing the arguments through is
 * not that.
 *
 * The one exemption is `packages/ui/src/hooks/`: a `.vue` may hold no logic and reaches the
 * domain only through its hook, so a hook member that forwards to the domain object it holds
 * is the seam doing its job (John, 2026-09-28: "the Vue must have no logic and must go through
 * the hooks, which in some cases might only wrap").
 *
 * A RATCHET: `FORWARDS_BASELINE` is the list on the day the gate landed. A new forward fails;
 * a baselined one that has been repaired must be struck from the list, so it only shrinks.
 */
import {describe, expect, it} from 'vitest';
import {Node, Project, type ParameterDeclaration, type SourceFile} from 'ts-morph';
import {packageRoot, ratchet, relPath, shippedSource} from './architecture-gate-support.js';

const FORWARDS_BASELINE: ReadonlySet<string> = new Set([
  "packages/design/domain/cell.ts#DefaultingFieldImpl.clear",
  "packages/design/domain/cell.ts#DefaultingFieldImpl.set",
  "packages/design/domain/cell.ts#DualWriteFieldImpl.clear",
  "packages/design/domain/cell.ts#DualWriteFieldImpl.set",
  "packages/design/domain/cell.ts#EnteredFieldImpl.clear",
  "packages/design/domain/cell.ts#EnteredFieldImpl.set",
  "packages/design/domain/cell.ts#SetOnlyFieldImpl.set",
  "packages/design/domain/driver/openISDDriver.ts#OpenISDDriver.fromWdrIniText",
  "packages/design/domain/driver/openISDDriver.ts#OpenISDDriver.issues",
  "packages/design/domain/passiveRadiator/openISDPassiveRadiatorEmbedded.ts#OpenISDPassiveRadiatorEmbedded.update",
  "packages/design/domain/project/openISDProject.ts#OpenISDProject.#notify",
  "packages/design/domain/project/openISDProject.ts#OpenISDProject.batch",
  "packages/design/domain/project/openISDProject.ts#OpenISDProject.classifyFinite",
  "packages/design/domain/project/openISDProject.ts#OpenISDProject.classifyFiniteIssues",
  "packages/design/domain/project/openISDProject.ts#OpenISDProject.classifyFlatClamp",
  "packages/design/domain/project/openISDProject.ts#OpenISDProject.classifyMaxFinite",
  "packages/design/domain/project/openISDProject.ts#OpenISDProject.fromWprText",
  "packages/design/domain/project/openISDProject.ts#OpenISDProject.notifyPrChanged",
  "packages/design/domain/project/openISDProject.ts#OpenISDProject.notifyVentChanged",
  "packages/design/domain/project/openISDProject.ts#OpenISDProject.passbandRef",
  "packages/design/domain/project/openISDProject.ts#OpenISDProject.recalc",
  "packages/design/domain/project/openISDProject.ts#OpenISDProject.rolloffFreq",
  "packages/design/domain/project/openISDProject.ts#OpenISDProject.setEnvHumidityPct",
  "packages/design/domain/project/openISDProject.ts#OpenISDProject.setEnvPressurePa",
  "packages/design/domain/project/openISDProject.ts#OpenISDProject.setEnvTempK",
  "packages/design/domain/project/openISDProject.ts#OpenISDProject.setEnvUseWinisdAirModel",
  "packages/design/domain/project/projectListeners.ts#ProjectListeners.add",
  "packages/design/domain/project/projectListeners.ts#ProjectListeners.delete",
  "packages/design/engine/Engine.ts#Engine.driveVoltage",
  "packages/design/engine/Engine.ts#Engine.ebp",
  "packages/design/engine/Engine.ts#Engine.ebpSuitability",
  "packages/design/engine/Engine.ts#Engine.envDefaults",
  "packages/design/engine/Engine.ts#Engine.findImpedancePeak",
  "packages/design/engine/Engine.ts#Engine.inconsistentInputs",
  "packages/design/engine/Engine.ts#Engine.isPhysicallyPlausible",
  "packages/design/engine/Engine.ts#Engine.issueFormula",
  "packages/design/engine/Engine.ts#Engine.missingDependencies",
  "packages/design/engine/Engine.ts#Engine.nonNegativeValueIssue",
  "packages/design/engine/Engine.ts#Engine.nonPhysicalQuantity",
  "packages/design/engine/Engine.ts#Engine.outOfRange",
  "packages/design/engine/Engine.ts#Engine.positiveValueIssue",
  "packages/design/engine/Engine.ts#Engine.quantityOutOfBand",
  "packages/design/engine/Engine.ts#Engine.solveDriver",
  "packages/design/engine/Engine.ts#Engine.solveEnvironment",
  "packages/design/engine/Engine.ts#Engine.solveSignal",
  "packages/design/engine/Engine.ts#Engine.targetUnreachable",
  "packages/design/engine/Engine.ts#Engine.terminalBL_Tm",
  "packages/design/engine/Engine.ts#Engine.terminalRe_ohm",
  "packages/ui/src/logic/appState.ts#currentProject",
  "packages/ui/src/logic/appState.ts#envDefaults",
  "packages/ui/src/logic/appState.ts#markProjectSaved",
  "packages/ui/src/logic/appState.ts#ventedLimits",
]);

/** The parameter names, in order, or `null` if any parameter is not a plain named one — a
 *  destructured or defaulted parameter is already a reshape. */
function plainParamNames(params: readonly ParameterDeclaration[]): string[] | null {
  const names: string[] = [];
  for (const p of params) {
    const name = p.getNameNode();
    if (!Node.isIdentifier(name) || p.hasInitializer()) return null;
    names.push(name.getText());
  }
  return names;
}

/** Is `call` exactly `g(p1, p2, …)` with the function's own parameters, unchanged, in order? */
function passesParamsThrough(call: Node, params: string[]): boolean {
  if (!Node.isCallExpression(call)) return false;
  const args = call.getArguments();
  if (args.length !== params.length) return false;
  return args.every((a, i) => Node.isIdentifier(a) && a.getText() === params[i]);
}

/** A body that is one statement: `return g(params…)` or the bare call `g(params…)`. */
function isForward(body: Node | undefined, params: string[] | null): boolean {
  if (!body || params === null || !Node.isBlock(body)) return false;
  const statements = body.getStatements();
  if (statements.length !== 1) return false;
  const [only] = statements;
  if (Node.isReturnStatement(only)) {
    const expr = only.getExpression();
    return expr !== undefined && passesParamsThrough(expr, params);
  }
  if (Node.isExpressionStatement(only)) return passesParamsThrough(only.getExpression(), params);
  return false;
}

/** Every forwarding function or method in one file, as `path#Owner.name` / `path#name`. */
export function forwardsIn(source: SourceFile, rel: string): string[] {
  const found: string[] = [];
  for (const fn of source.getFunctions()) {
    if (isForward(fn.getBody(), plainParamNames(fn.getParameters()))) found.push(`${rel}#${fn.getName() ?? '<anonymous>'}`);
  }
  for (const cls of source.getClasses()) {
    for (const m of cls.getMethods()) {
      if (isForward(m.getBody(), plainParamNames(m.getParameters()))) found.push(`${rel}#${cls.getName() ?? '<anonymous>'}.${m.getName()}`);
    }
  }
  return found;
}

function isHook(rel: string): boolean {
  return rel.startsWith('packages/ui/src/hooks/');
}

describe('no-forwards gate — it can fail (non-vacuous demonstration)', () => {
  it('flags a pass-through and accepts a reshape', () => {
    const demo = new Project({useInMemoryFileSystem: true});
    const src = demo.createSourceFile('/demo.ts', [
      'declare function g(a: number, b: number): number;',
      'export function forward(a: number, b: number): number { return g(a, b); }',
      'export function reorders(a: number, b: number): number { return g(b, a); }',
      'export function adds(a: number): number { return g(a, 1); }',
      'export class C { m(a: number, b: number): number { return g(a, b); } fire(a: number, b: number): void { g(a, b); } }',
    ].join('\n'));
    expect(forwardsIn(src, 'demo.ts')).toEqual(['demo.ts#forward', 'demo.ts#C.m', 'demo.ts#C.fire']);
  });
});

describe('no forwarding functions outside the hooks — ratchet', () => {
  it('no forward outside the baseline, and every baselined forward still exists', () => {
    const found: string[] = [];
    for (const source of shippedSource().getSourceFiles()) {
      const rel = relPath(source.getFilePath());
      if (rel.startsWith(relPath(packageRoot) + '/test/') || isHook(rel)) continue;
      found.push(...forwardsIn(source, rel));
    }
    const {added, gone} = ratchet(found, FORWARDS_BASELINE);
    expect(added, [
      'A function whose whole body forwards its own parameters to one other call adds a name',
      'and nothing else. Delete it and call the thing it forwards to; if a layer needs the',
      'call reshaped, reshape it there. (John, 2026-09-28: "all this useless wrapping".)',
    ].join(' ')).toEqual([]);
    expect(gone, 'These baselined forwards are gone — strike them from FORWARDS_BASELINE so the ratchet keeps shrinking.').toEqual([]);
  });
});
