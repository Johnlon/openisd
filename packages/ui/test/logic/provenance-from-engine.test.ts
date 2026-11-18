import {describe, expect, it} from 'vitest';
import {DRIVER_SOLVE_ROUTES} from '../../../design/engine/driver/routes/index.js';
import type {DriverRoute} from '../../../design/engine/driver/routes/index.js';
import {createEngine} from '@openisd/design/engine';
import {getProvenanceInfo, provenanceMap} from '../../src/logic/provenance.js';

/**
 * T902, bugs/BUG_20261118_formula-panel-is-a-hand-typed-copy-of-the-engine.md: the Driver Editor's formula panel
 * (Inspect Provenance) shows the formulas the engine really solves, taken from the engine's routes, not a hand-typed
 * copy in the UI. The copy had drifted: it said Hc = 2 × Xmax + Hg (16 mm for Hg 10 mm, Xmax 3 mm) where the engine
 * gives Hg − 2 × Xmax (4 mm), and listed a Vas route the engine does not have.
 */
/** The panel's formulas as the Driver Editor gets them. */
const PROVENANCE_MAP = provenanceMap(createEngine().driver.routeFormulas());
const signature = (inputs: readonly string[]): string => [...inputs].sort().join('+');
const textOf = (route: DriverRoute): string => route.formulaText;

describe('the formula panel shows the engine\'s routes, and only them', () => {
  it('every formula the panel shows is an engine route to that field, with the route\'s own text and inputs', () => {
    const notInEngine: string[] = [];
    for (const [field, spec] of Object.entries(PROVENANCE_MAP)) {
      for (const path of spec.paths) {
        const route = DRIVER_SOLVE_ROUTES.find(r => r.target === field && signature(r.inputs) === signature(path.inputs)
          && textOf(r) === path.formulaText);
        if (route === undefined) notInEngine.push(`${field}: ${path.formulaText} [${signature(path.inputs)}]`);
      }
    }
    expect(notInEngine).toEqual([]);
  });

  it('every engine route is on the panel, in the engine\'s order', () => {
    const targets = [...new Set(DRIVER_SOLVE_ROUTES.map(r => r.target))];
    for (const target of targets) {
      const expected = DRIVER_SOLVE_ROUTES.filter(r => r.target === target).map(r => ({formulaText: textOf(r), inputs: [...r.inputs]}));
      const shown = (getProvenanceInfo(PROVENANCE_MAP, target)?.paths ?? []).map(p => ({formulaText: p.formulaText, inputs: [...p.inputs]}));
      expect(shown, target).toEqual(expected);
    }
  });

  it('Hc with Hg 10 mm and Xmax 3 mm: the formula shown is the one that gives the engine\'s 4 mm', () => {
    const routes = DRIVER_SOLVE_ROUTES.filter(r => r.target === 'Hc_m');
    expect(routes).toHaveLength(1);
    expect(routes[0].value({Hg_m: 0.010, Xmax_m: 0.003})).toBeCloseTo(0.004, 12);
    const paths = getProvenanceInfo(PROVENANCE_MAP, 'Hc_m')?.paths ?? [];
    expect(paths.map(p => p.formulaText)).toEqual([textOf(routes[0])]);
    expect(paths[0].formulaText).toContain('Hg_m − 2 × Xmax_m');
  });

  it('the panel lists no Vas route the engine lacks', () => {
    const shown = (PROVENANCE_MAP.Vas_m3?.paths ?? []).map(p => signature(p.inputs)).sort();
    const engine = DRIVER_SOLVE_ROUTES.filter(r => r.target === 'Vas_m3').map(r => signature(r.inputs)).sort();
    expect(shown).toEqual(engine);
  });
});
