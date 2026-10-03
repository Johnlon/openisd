import {describe, expect, it} from 'vitest';
import {ref} from 'vue';
import {createEngine} from '@openisd/design/engine';
import {OpenISDProject, ProjectBuilder} from '@openisd/design';
import {ChartSelection} from '../../src/hooks/chartSelection.js';
import {CHART_LABELS} from '@openisd/design/chart';

function createCompleteProject() {
  const engine = createEngine();
  const project = ProjectBuilder.empty(engine);
  project.driver.specs.Fs_hz.set(40);
  project.driver.specs.Qts.set(0.38);
  project.driver.specs.Qes.set(0.45);
  project.driver.specs.Vas_m3.set(0.03);
  project.box.sealed.volume_m3.set(0.012);
  return {engine, project};
}

describe('ChartSelection', () => {
  function harness(project: OpenISDProject | null) {
    const engine = createEngine();
    const projectChanged = ref(0);
    const tick = (): void => { projectChanged.value++; };
    const sel = new ChartSelection(() => project, projectChanged, engine.box);
    return { tick, engine, sel, openCharts: sel.openCharts, chartItems: sel.chartItems, chartLabel: sel.chartLabel };
  }

  it('with no project, lists the default box\'s charts and shows the default chart', () => {
    const h = harness(null);
    expect(h.chartItems.value.map(i => i.tab)).toEqual(h.engine.box.chartsFor(h.engine.box.defaultBoxType));
    expect(h.openCharts.value).toEqual([h.engine.box.defaultChart]);
  });

  it('marks the open charts in the menu items', () => {
    const {project} = createCompleteProject();
    project.graphs.set(['SPL', 'Zmag']);
    const h = harness(project);
    expect(h.chartItems.value.filter(i => i.open).map(i => i.tab)).toEqual(project.openCharts.value);
  });

  it('showOnly shows one chart; toggle adds and removes', () => {
    const {project} = createCompleteProject();
    const h = harness(project);
    h.sel.showOnly('Zmag'); h.tick();
    expect(h.openCharts.value).toEqual(['Zmag']);
    h.sel.toggle('Excursion'); h.tick();
    expect(h.openCharts.value).toEqual(project.charts.filter(c => c === 'Zmag' || c === 'Excursion'));
    h.sel.toggle('Zmag'); h.tick();
    expect(h.openCharts.value).toEqual(['Excursion']);
  });

  it('chartLabel names every open chart', () => {
    const {project} = createCompleteProject();
    const h = harness(project);
    h.sel.showOnly('SPL'); h.sel.toggle('Zmag'); h.tick();
    expect(h.chartLabel.value).toBe(project.openCharts.value.map(c => CHART_LABELS[c]).join(', '));
  });

  it('showOnly and toggle do nothing with no project', () => {
    const h = harness(null);
    h.sel.showOnly('Zmag'); h.sel.toggle('Zmag'); h.tick();
    expect(h.openCharts.value).toEqual([h.engine.box.defaultChart]);
  });
});
