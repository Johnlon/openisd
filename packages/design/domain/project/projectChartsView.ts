import type { BoxEngine, BoxType, ChartId } from '../../engine/index.js';
import { focus } from '../cell.js';
import type { SimpleField } from '../cell.js';
import type { OpenISDProjectJson } from '../openisdSchema.js';

/** The charts shown at once, stacked. `value`: the stored `graphs` this box shows, in chart-menu
 *  order; never empty — the default chart alone when none of `graphs` applies. */
export interface OpenCharts {
    readonly value: readonly ChartId[];
    /** Shows `id` alone. */
    showOnly(id: ChartId): void;
    /** Opens `id` if closed, closes it if open. The last open chart stays open. */
    toggle(id: ChartId): void;
}

/** A project's own chart-view window, built fresh on every access — same reasoning as
 *  `driver`/`box`/`ProjectMeta`/`ProjectAdvanced` (PLAN_openisdproject_split.md). `boxType` is
 *  passed in rather than reached for: it lives on `OpenISDProject.box`, and this class has no
 *  business constructing a box window of its own.
 *
 *  `cursorF`/`pinnedF`/`cursorLocked`/`dragRange` stay on `OpenISDProject` itself, NOT here:
 *  `architecture-project-has-three-fields.test.ts` (QO168) requires them as `OpenISDProject`'s
 *  own private fields, never routed through a record or a second module. */
export class ProjectChartsView {
    readonly #lens: SimpleField<OpenISDProjectJson['charts']>;
    readonly #engine: BoxEngine;
    readonly #boxType: () => BoxType;

    constructor(lens: SimpleField<OpenISDProjectJson['charts']>, engine: BoxEngine, boxType: () => BoxType) {
        this.#lens = lens;
        this.#engine = engine;
        this.#boxType = boxType;
    }

    /** Which charts are open (S10/QO130) — PROJECT-scoped, reversing QO90 for this field.
     *  Empty when absent (a project saved before S10, or a fresh one). Plain strings, not
     *  `ChartId`: this is PERSISTED project data (`.owpr`), so it must stay readable across a
     *  version skew that adds/removes chart ids — `parseChartId` (packages/ui `logic/series.ts`)
     *  does the string↔member conversion at the UI boundary. */
    get graphs(): SimpleField<readonly string[]> {
        const lens = focus(this.#lens, 'graphs');
        return {
            get value() { return lens.value ?? []; },
            set: (ids) => lens.set([...ids]),
        };
    }

    /** Which charts this project's box type shows, in WinISD's own chart-menu order — a design
     *  decision, not a UI one (bugs/archive/BUG_20260927_winisd-charts-missing.md): port charts only
     *  for a ported box, PR charts only for a radiator, the ten system charts and the three
     *  EQ/filter charts always. The UI shows exactly the ids this returns, never a second list
     *  of "which charts apply". */
    get charts(): readonly ChartId[] {
        return this.#engine.chartsFor(this.#boxType());
    }

    /** The charts shown at once, stacked (see `OpenCharts`). */
    get openCharts(): OpenCharts {
        const graphs = this.graphs;
        const charts = this.charts;
        const fallback = this.#engine.defaultChart;
        const read = (): readonly ChartId[] => {
            const stored = graphs.value;
            const open = charts.filter(c => stored.includes(c));
            return open.length ? open : [fallback];
        };
        return {
            get value() { return read(); },
            showOnly: (id) => graphs.set([id]),
            toggle: (id) => {
                const open = read();
                if (!open.includes(id)) graphs.set([...open, id]);
                else if (open.length > 1) graphs.set(open.filter(c => c !== id));
            },
        };
    }

    /** The project's trace/legend colour (a CSS colour), saved in the project file; null until
     *  first assigned. Chart view state, so `isModified()` ignores it. */
    get traceColor(): SimpleField<string | null> {
        const charts = this.#lens;
        return {
            get value() { return charts.value.traceColor ?? null; },
            set: (v) => charts.set({...charts.value, traceColor: v ?? undefined}),
        };
    }

    get sweepN(): SimpleField<number | null> {
        const charts = this.#lens;
        return {
            get value() { return charts.value.N ?? null; },
            set: (v) => charts.set({...charts.value, N: v ?? undefined}),
        };
    }
}
