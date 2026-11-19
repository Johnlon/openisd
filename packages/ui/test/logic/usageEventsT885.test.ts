import {silentPerf} from '../fixtures/silentPerf.js';
/**
 * T885: usage events for an empty driver search, wiring use, disagreeing or refused values, the announcement popup and the
 * start-up restore (John, 18 Nov 2026, QO946.c240: "ok are any more things that ought to send Tel we metry / all").
 */
import {describe, expect, it} from 'vitest';
import {nextTick, ref} from 'vue';
import {OpenISDDriver, OpenISDProject, ProjectBuilder} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import {readFileSync} from 'node:fs';
import {fieldsOf, type TelemetryEvent} from '../../src/logic/telemetry/events.js';
import {FeatureUse} from '../../src/logic/telemetry/featureUse.js';
import {driverTelemetryId} from '../../src/logic/telemetry/projectDriver.js';
import {disagreeingFieldIds, reportDisagreementsSeen} from '../../src/logic/telemetry/valuesProblem.js';
import {createDriverBrowsingState} from '../../src/logic/driverBrowsingState.js';
import {createAnnouncementCenter, announcementEndpointsForHostname} from '../../src/logic/announcementCenter.js';
import {useAnnouncementTelemetry} from '../../src/hooks/Announcements-hooks.js';
import {useDriverWiring} from '../../src/hooks/DriverWiring-hooks.js';
import {useDriverCoilWiring} from '../../src/hooks/DriverCoilWiring-hooks.js';
import {useRefusalSeen} from '../../src/hooks/refusalSeen.js';
import {createAppStateFixture} from '../fixtures/appStateFixture.js';
import {recordingTelemetryUi} from '../fixtures/recordingTelemetryUi.js';
import {runHook} from '../hooks/runHook.js';
import {testAppLogic} from '../hooks/testAppLogic.js';
import {computed} from 'vue';

function bundledDriver(file = 'da215-8'): OpenISDDriver {
  const d = OpenISDDriver.fromOwdrText(readFileSync(`packages/ui/public/drivers/dayton-audio/${file}.json`, 'utf8'), createEngine());
  if (Array.isArray(d)) throw new Error(d.join('; '));
  return d;
}

describe('wire form of the new events', () => {
  it('projects_restored carries only the count', () => {
    expect(fieldsOf({kind: 'projects_restored', count: 8})).toEqual({count: 8});
  });
  it('driver_search_empty carries closed sets and the text length, never text', () => {
    const e: TelemetryEvent = {kind: 'driver_search_empty', scope: 'all', types: 'sub', sizes: '10', impedances: '4,8', ranges: 'fs', favorites: false, textLength: 4};
    expect(fieldsOf(e)).toEqual({scope: 'all', types: 'sub', sizes: '10', impedances: '4,8', ranges: 'fs', favorites: false, textLength: 4});
  });
  it('values_problem_seen and announcement', () => {
    expect(fieldsOf({kind: 'values_problem_seen', problem: 'refused', field: 'Fs_hz', driver: 'own'})).toEqual({problem: 'refused', field: 'Fs_hz', driver: 'own'});
    expect(fieldsOf({kind: 'announcement', stage: 'seen', id: 'a1', view: 'latest'})).toEqual({stage: 'seen', id: 'a1', view: 'latest'});
  });
});

describe('start-up restore sends one projects_restored', () => {
  it('3 restored projects: one projects_restored with count 3 and no project_open', () => {
    const events: TelemetryEvent[] = [];
    const {appState} = createAppStateFixture(undefined, {record: e => events.push(e), flush: () => undefined});
    const projects = [1, 2, 3].map(() => ProjectBuilder.empty(appState.engine));
    appState.restoreProjects(projects, 0, new Set<OpenISDProject>());
    appState.recordStartupRestoredProjects();
    expect(events).toEqual([{kind: 'projects_restored', count: 3}]);
  });
  it('no restored project: nothing is sent', () => {
    const events: TelemetryEvent[] = [];
    const {appState} = createAppStateFixture(undefined, {record: e => events.push(e), flush: () => undefined});
    appState.recordStartupRestoredProjects();
    expect(events).toEqual([]);
  });
});

describe('driver search with no results', () => {
  function browsing() {
    const app = testAppLogic();
    const {telemetryUi, events} = recordingTelemetryUi();
    const b = createDriverBrowsingState({perf: silentPerf(), 
      driverRepo: {...app.bundledDrivers, index: async () => []}, myDriverRepo: app.myDrivers, prefs: app.prefs, logging: app.logging,
      selection: app.selection, files: app.designFiles, confirmReset: app.confirmPort.port, exportNotice: {exported: () => undefined},
      appState: app.appState, presentation: app.presentation, driverPicked: () => undefined, featureUse: telemetryUi.featureUse,
    });
    return {b, events};
  }
  const settle = async () => { await Promise.resolve(); await nextTick(); await nextTick(); };

  it('sends the chosen filters once, and the typed text only as a length', async () => {
    const {b, events} = browsing();
    b.openedLibrary();
    await settle();
    b.toggleZ('8');
    b.toggleSize(b.SIZE_CLASSES[0].value);
    b.filterQ.value = 'secret';
    await settle();
    expect(events).toEqual([{
      kind: 'driver_search_empty', scope: 'all', types: '', sizes: b.SIZE_CLASSES[0].value, impedances: '8', ranges: '', favorites: false, textLength: 6,
    }]);
  });

  it('typing more of the same text sends nothing more; another filter set sends again', async () => {
    const {b, events} = browsing();
    b.openedLibrary();
    await settle();
    b.filterQ.value = 'ab'; await settle();
    b.filterQ.value = 'abc'; await settle();
    b.filterQ.value = 'abcd'; await settle();
    expect(events).toHaveLength(1);
    b.toggleZ('4'); await settle();
    expect(events).toHaveLength(2);
    b.toggleZ('4'); await settle();   // back to a set already reported
    expect(events).toHaveLength(2);
  });

  it('no filter on: nothing is sent', async () => {
    const {b, events} = browsing();
    b.openedLibrary();
    await settle();
    expect(events).toEqual([]);
  });
});

describe('wiring use', () => {
  function project(nDrivers: number, file = 'da215-8') {
    const logic = testAppLogic();
    const p = new ProjectBuilder(bundledDriver(file), logic.appState.engine).sealed().volume_m3(0.16).build();
    p.nDrivers.set(nDrivers);
    logic.appState.addProject(p);
    return {logic, p};
  }
  it('several-driver wiring changed', () => {
    const {logic, p} = project(4);
    const {telemetryUi, events} = recordingTelemetryUi();
    const w = runHook(computed(() => p), () => useDriverWiring(), logic, telemetryUi);
    w.choose('series');
    expect(events).toEqual([{kind: 'feature', name: 'multi_driver_wiring_changed'}]);
  });
  it('coil wiring changed', () => {
    const {logic, p} = project(1, 'mx6-22');
    const {telemetryUi, events} = recordingTelemetryUi();
    const w = runHook(computed(() => p), () => useDriverCoilWiring(false), logic, telemetryUi);
    w.choose('series');
    expect(events).toEqual([{kind: 'feature', name: 'coil_wiring_changed'}]);
  });
});

describe('values disagree or refused entry seen', () => {
  const sent = () => { const r = recordingTelemetryUi(); return {...r, featureUse: r.telemetryUi.featureUse}; };

  it('a bundled driver is named by id, any other as own', () => {
    const d = bundledDriver();
    expect(driverTelemetryId(d)).toBe(`${d.brand.value} ${d.model.value}`.trim());
    expect(driverTelemetryId(d)).not.toBe('own');
    d.providedBy.set('My Drivers');
    expect(driverTelemetryId(d)).toBe('own');
  });

  it('disagreeing fields are reported once per field per driver', () => {
    const {events, featureUse} = sent();
    const d = bundledDriver();
    d.specs.Fs_hz.set(40); d.specs.Qts.set(0.3); d.specs.Qes.set(0.9); d.specs.Qms.set(2);
    const fields = disagreeingFieldIds(d);
    expect(fields.length).toBeGreaterThan(0);
    reportDisagreementsSeen(featureUse, d);
    reportDisagreementsSeen(featureUse, d);
    expect(events).toEqual(fields.map(field => ({kind: 'values_problem_seen', problem: 'disagree', field, driver: driverTelemetryId(d)})));
  });

  it('a refused entry is reported once per field per driver, with the focused project driver', () => {
    const logic = testAppLogic();
    const p = new ProjectBuilder(bundledDriver(), logic.appState.engine).sealed().volume_m3(0.16).build();
    logic.appState.addProject(p);
    const {telemetryUi, events} = recordingTelemetryUi();
    const seen = runHook(computed(() => p), () => useRefusalSeen(), logic, telemetryUi);
    seen('Fs_hz'); seen('Fs_hz'); seen('Qts');
    expect(events).toEqual([
      {kind: 'values_problem_seen', problem: 'refused', field: 'Fs_hz', driver: driverTelemetryId(p.driver)},
      {kind: 'values_problem_seen', problem: 'refused', field: 'Qts', driver: driverTelemetryId(p.driver)},
    ]);
  });
});

describe('announcement popup', () => {
  const item = {id: 'a1', version: '1.0', published: '2026-11-01', title: 't', summary: 's', body: ['b'], href: 'h'};
  const store = () => { const m = new Map<string, string>(); return {getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }}; };
  const fetchOf = (): typeof fetch => async () => new Response(JSON.stringify({version: 1, announcements: [item]}), {status: 200});

  it('seen when it opens (not behind the splash) and dismissed when it goes', async () => {
    const {telemetryUi, events} = recordingTelemetryUi();
    const center = createAnnouncementCenter(store(), fetchOf(), announcementEndpointsForHostname('test.openisd.app'));
    const splash = ref(true);
    useAnnouncementTelemetry(center, () => splash.value, telemetryUi.featureUse);
    await center.load();
    expect(events).toEqual([]);
    splash.value = false;
    expect(events).toEqual([{kind: 'announcement', stage: 'seen', id: 'a1', view: 'latest'}]);
    center.dismissLatest();
    expect(events.slice(1)).toEqual([{kind: 'announcement', stage: 'dismissed', id: 'a1', view: 'latest'}]);
  });

  it('the list view is seen then closed', async () => {
    const {telemetryUi, events} = recordingTelemetryUi();
    const center = createAnnouncementCenter(store(), fetchOf(), announcementEndpointsForHostname('snapshots.openisd.app'));
    useAnnouncementTelemetry(center, () => false, telemetryUi.featureUse);
    await center.load();
    center.showList();
    center.closeList();
    expect(events).toEqual([
      {kind: 'announcement', stage: 'seen', id: 'a1', view: 'list'},
      {kind: 'announcement', stage: 'closed', id: 'a1', view: 'list'},
    ]);
  });
});

describe('FeatureUse once-only rules', () => {
  it('an empty search is sent once per filter set, whatever the text length', () => {
    const events: TelemetryEvent[] = [];
    const f = new FeatureUse({record: e => events.push(e), flush: () => undefined});
    const base = {kind: 'driver_search_empty', scope: 'all', types: '', sizes: '', impedances: '', ranges: '', favorites: false} as const;
    f.driverSearchEmpty({...base, textLength: 2});
    f.driverSearchEmpty({...base, textLength: 3});
    f.driverSearchEmpty({...base, textLength: 0});
    expect(events).toHaveLength(2);
  });
});

describe('announcement events are sent once per stage per announcement', () => {
  it('a popup seen twice in one session sends one seen', () => {
    const {telemetryUi, events} = recordingTelemetryUi();
    const seen = {kind: 'announcement', stage: 'seen', id: 'a1', view: 'latest'} as const;
    telemetryUi.featureUse.announcement(seen);
    telemetryUi.featureUse.announcement(seen);
    telemetryUi.featureUse.announcement({kind: 'announcement', stage: 'dismissed', id: 'a1', view: 'latest'});
    expect(events).toEqual([seen, {kind: 'announcement', stage: 'dismissed', id: 'a1', view: 'latest'}]);
  });
});

describe('feedback_prompt events', () => {
  it('go out with the one outcome field, once per outcome per session, and nothing else', () => {
    const {telemetryUi, events} = recordingTelemetryUi();
    telemetryUi.featureUse.feedbackPrompt({kind: 'feedback_prompt', outcome: 'shown'});
    telemetryUi.featureUse.feedbackPrompt({kind: 'feedback_prompt', outcome: 'shown'});
    telemetryUi.featureUse.feedbackPrompt({kind: 'feedback_prompt', outcome: 'not_now'});
    telemetryUi.featureUse.feedbackPrompt({kind: 'feedback_prompt', outcome: 'closed'});
    expect(events.map(e => [e.kind, fieldsOf(e)])).toEqual([
      ['feedback_prompt', {outcome: 'shown'}], ['feedback_prompt', {outcome: 'not_now'}], ['feedback_prompt', {outcome: 'closed'}],
    ]);
  });
});
