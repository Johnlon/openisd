/**
 * The compare-overlay curves: a Design per OTHER open project, swept on its own frequency range,
 * following each row's show/hide checkbox. The focused project is the primary design; every
 * other open project contributes a trace (BUG_20260917_nonfocused-project-traces-never-drawn).
 * A project the engine cannot sweep (bandpass6/abc, or an incomplete driver) contributes
 * nothing — `buildPlotData` would crash on an overlay without curves.
 * Re-sweeps an overlay project only when its own sweep job changes: editing the focused project
 * re-runs this computed, and re-sweeping every other project per spinner step blocked the page.
 */
import {computed, type ComputedRef} from 'vue';
import type {OpenISDProject} from '@openisd/design';
import type {SimulationEngine} from '@openisd/design/engine';
import {boxTypeIsSimulatable, openProjects, projectChanged, projectDisplayName} from '../logic/appState.js';
import {presentationState, traceColor} from '../logic/presentationState.js';
import {SweepCache} from '../logic/sweepCache.js';
import {SweepComputer} from '../logic/sweepRequest.js';
import {isTraceVisible, traceVisibilityRevision} from '../logic/traceVisibility.js';
import type {Design, PlotParams} from '../types.js';

export function useCompareOverlays(simulation: SimulationEngine, focusedProject: ComputedRef<OpenISDProject>): ComputedRef<Design[]> {
  const sweeps = new SweepCache(new SweepComputer(simulation));
  return computed<Design[]>(() => {
    void projectChanged.value;
    void traceVisibilityRevision.value;
    const focused = focusedProject.value;
    const projects = openProjects();
    const out: Design[] = [];
    for (const p of projects) {
      if (p === focused) continue;
      const box = p.box.boxType.value;
      if (!boxTypeIsSimulatable(box)) continue;
      const prXmax = box === 'box-passive-radiator'
        ? (p.box.passiveRadiator.radiator.spec.Xmax_m.value ?? undefined)
        : undefined;
      const P: PlotParams = {
        fmin: presentationState.sweepRange.min,
        fmax: presentationState.sweepRange.max,
        splXmaxLimited: p.splGraphIsXmaxLimited.value,
        prXmax,
        portVelocityLimit_m_per_s: p.portVelocityLimit_m_per_s.value,
      };
      const swept = sweeps.sweep(p, { fmin: P.fmin, fmax: P.fmax });
      const sw = swept?.sweep, mx = swept?.max;
      if (!sw?.values || !mx?.values) continue;
      out.push({
        driver: p.driver.specs.sweepDriver(),
        box,
        P,
        curves: sw.values,
        maxCurves: mx.values,
        name: projectDisplayName(p),
        color: traceColor(p),
        visible: isTraceVisible(p),
        // Legend/draw order follows the sidebar's project list order, not "current first"
        // (John, 2026-09-24: "Dont change the legend project order - keep it the same as the
        // side bar proj list").
        sortIndex: projects.indexOf(p),
      });
    }
    return out;
  });
}
