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
 * THE ENGINE IS NOT THREADED THROUGH PARAMETERS. Dependency injection means a component is
 * CONSTRUCTED with the engine (or the one engine area it uses) and holds it; a free function
 * taking `engine: Engine` is the opposite — every caller has to have an engine to hand, so the
 * engine spreads to APIs that have no business with it. John, 2026-09-28: "instead of cohesive
 * components into which the engine can be injected, it creates a myriad of independent global
 * methods that need the engine injected … DI means less coupling, not more."
 *
 * Constructors are the one legitimate `engine` parameter and are not counted.
 *
 * A RATCHET: `ENGINE_PARAMETER_BASELINE` is the list on the day the gate landed. A new site
 * fails; a repaired one must be struck, so the list only shrinks.
 */
import {describe, expect, it} from 'vitest';
import {Project, type SourceFile} from 'ts-morph';
import {packageRoot, ratchet, relPath, shippedSource} from './architecture-gate-support.js';

const ENGINE_PARAMETER_BASELINE: ReadonlySet<string> = new Set([
  "packages/design/domain/box/openISDBox.ts#OpenISDBox.wrap",
  "packages/design/domain/driver/openISDDriver.ts#OpenISDDriver.empty",
  "packages/design/domain/driver/openISDDriver.ts#OpenISDDriver.fromConformingRecord",
  "packages/design/domain/driver/openISDDriver.ts#OpenISDDriver.fromOwdrText",
  "packages/design/domain/driver/openISDDriver.ts#OpenISDDriver.fromWdrIniText",
  "packages/design/domain/driver/openISDDriver.ts#OpenISDDriver.toWdrIniText",
  "packages/design/domain/driver/openISDDriver.ts#OpenISDDriverStandalone.wrap",
  "packages/design/domain/driver/openISDDriverEmbedded.ts#OpenISDDriverEmbedded.wrap",
  "packages/design/domain/driver/openIsdDriverSpec.ts#floorIssue",
  "packages/design/domain/driverRoundTripDiffs.ts#roundTripProblems",
  "packages/design/domain/driverRoundTripDiffs.ts#wdrRecordRoundTripDiffs",
  // `driverYmlToOpenisdAndWdr` joined the list the day the gate landed: it had been building
  // its own engine, and receiving one from the bridge's root is the smaller wrong. The class
  // it belongs on (plan: D) strikes all five of this file's rows together.
  "packages/design/domain/driverYmlToOpenisdAndWdr.ts#driverYmlToOpenisdAndWdr",
  "packages/design/domain/driverYmlToOpenisdAndWdr.ts#driverYmlToOpenisdRecord",
  "packages/design/domain/driverYmlToOpenisdAndWdr.ts#projectScraperEntry",
  "packages/design/domain/driverYmlToOpenisdAndWdr.ts#projectSpecs",
  "packages/design/domain/driverYmlToOpenisdAndWdr.ts#stripScraperOnlyFieldsFromJavascriptObject",
  "packages/design/domain/driverYmlToOpenisdAndWdr.ts#winIsdDriverTextToOpenIsdDriver",
  "packages/design/domain/openIsdProjectToWinIsdProject.ts#filtersSectionValues",
  "packages/design/domain/openIsdProjectToWinIsdProject.ts#importFilters",
  "packages/design/domain/openIsdProjectToWinIsdProject.ts#openIsdProjectToWinIsdProject",
  "packages/design/domain/openIsdProjectToWinIsdProject.ts#winIsdProjectToOpenIsdProject",
  "packages/design/domain/passiveRadiator/openISDPassiveRadiatorStandalone.ts#OpenISDPassiveRadiatorStandalone.empty",
  "packages/design/domain/passiveRadiator/openISDPassiveRadiatorStandalone.ts#OpenISDPassiveRadiatorStandalone.fromConformingRecord",
  "packages/design/domain/passiveRadiator/openISDPassiveRadiatorStandalone.ts#OpenISDPassiveRadiatorStandalone.wrap",
  "packages/design/domain/project/projectChartsView.ts#ProjectChartsView.wrap",
  "packages/design/domain/project/projectEnvironment.ts#ProjectEnvironment.wrap",
  "packages/design/domain/project/projectEnvironment.ts#envFieldsOver",
  "packages/design/domain/project/projectSerialization.ts#wprTextOf",
  "packages/design/domain/project/projectSignal.ts#ProjectSignal.wrap",
  "packages/design/domain/project/openISDProject.ts#OpenISDProject.builder",
  "packages/design/domain/project/openISDProject.ts#OpenISDProject.empty",
  "packages/design/domain/project/openISDProject.ts#OpenISDProject.fromOwprText",
  "packages/design/domain/project/openISDProject.ts#OpenISDProject.fromWprText",
  "packages/design/domain/project/openISDProject.ts#OpenISDProject.toWprText",
  "packages/design/domain/project/openISDProject.ts#OpenISDProject.wrap",
  "packages/design/domain/project/openISDProject.ts#OpenISDProject.wrapSession",
  "packages/design/domain/project/openISDProject.ts#OpenISDProject.wrapWithIdentity",
  "packages/ui/src/logic/series.ts#buildPlotData",
  "packages/ui/src/logic/series.ts#parseChartId",
  "packages/ui/src/logic/series.ts#seriesFor",
]);

/** Every non-constructor function or method with a parameter typed `Engine`. */
export function engineParametersIn(source: SourceFile, rel: string): string[] {
  const found: string[] = [];
  const takesEngine = (params: {getTypeNode(): {getText(): string} | undefined}[]) =>
    params.some(p => p.getTypeNode()?.getText() === 'Engine');
  for (const fn of source.getFunctions()) {
    if (takesEngine(fn.getParameters())) found.push(`${rel}#${fn.getName() ?? '<anonymous>'}`);
  }
  for (const cls of source.getClasses()) {
    for (const m of cls.getMethods()) {
      if (takesEngine(m.getParameters())) found.push(`${rel}#${cls.getName() ?? '<anonymous>'}.${m.getName()}`);
    }
  }
  return found;
}

describe('engine-parameter gate — it can fail (non-vacuous demonstration)', () => {
  it('flags a function and a method taking Engine; ignores a constructor', () => {
    const demo = new Project({useInMemoryFileSystem: true});
    const src = demo.createSourceFile('/demo.ts', [
      'declare class Engine {}',
      'export function f(engine: Engine): void {}',
      'export class C { constructor(private readonly engine: Engine) {} static make(engine: Engine): C { return new C(engine); } ok(): void {} }',
    ].join('\n'));
    expect(engineParametersIn(src, 'demo.ts')).toEqual(['demo.ts#f', 'demo.ts#C.make']);
  });
});

describe('the engine is injected, never threaded — ratchet', () => {
  it('no engine parameter outside the baseline, and every baselined one still exists', () => {
    const found: string[] = [];
    for (const source of shippedSource().getSourceFiles()) {
      const rel = relPath(source.getFilePath());
      if (rel.startsWith(relPath(packageRoot) + '/test/')) continue;
      found.push(...engineParametersIn(source, rel));
    }
    const {added, gone} = ratchet(found, ENGINE_PARAMETER_BASELINE);
    expect(added, [
      'A function taking `engine: Engine` threads the engine through every caller. Make it a',
      'method on the object that already holds the engine, or a class constructed with the one',
      'engine area it uses.',
    ].join(' ')).toEqual([]);
    expect(gone, 'These baselined sites are gone — strike them from ENGINE_PARAMETER_BASELINE.').toEqual([]);
  });
});
