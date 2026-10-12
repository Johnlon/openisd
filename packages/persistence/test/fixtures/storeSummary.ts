/** What the current app yields from a store, and what its loaders write back: the two views the
 *  golden tests hold a store to. Everything is read and written through the real repos. */
import {OpenISDDriver, OpenISDProject} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import type {ListableStorage} from '../../src/storage/keyValueStorage.js';
import {storedProjectsPayload} from '../../src/repos/projectRepo.js';
import {
  OPENISD_OPEN_SESSIONS_KEY, OPENISD_PROJECTS_KEY, OPENISD_STATE_KEY, OPENISD_STORAGE_LAYOUT_KEY, OPENISD_VIEW_KEY,
} from '../../src/repos/storageKeys.js';
import {isStoreDataKey} from '../../src/repos/storageSnapshot.js';
import {createPrefsRepo} from '../../src/repos/prefsRepo.js';
import {appSettingsRepoOn, myDriverRepoOn, myPassiveRadiatorRepoOn, projectRepoOn, viewStateRepoOn} from './repoOn.js';
import type {Dump} from './goldens.js';

const engine = createEngine();
const noFiles = {
  save: () => { throw new Error('no file is written'); }, saveAs: () => { throw new Error('no file is written'); },
  openFileName: () => null, forget: () => { throw new Error('no file is written'); },
};

/** The golden view of a store: every data key plus the layout stamp, in key order. */
export function dumpOf(storage: ListableStorage): Dump {
  const out: Record<string, string> = {};
  for (const key of storage.keys().sort()) {
    const value = storage.get(key);
    if (value !== null && (isStoreDataKey(key) || key === OPENISD_STORAGE_LAYOUT_KEY)) out[key] = value;
  }
  return out;
}

export interface StoreSummary {
  readonly projects: readonly {readonly id: string; readonly name: string; readonly modified: string; readonly summary: string}[];
  readonly drivers: readonly {readonly uuid: string; readonly driver: string}[];
  readonly radiators: readonly {readonly uuid: string; readonly radiator: string}[];
  readonly openSession: {readonly names: readonly string[]; readonly focused: string | null; readonly traceHidden: readonly string[]} | null;
  readonly settings: {readonly vented: unknown; readonly env: unknown; readonly differenceCues: boolean};
  readonly favourites: {readonly drivers: readonly string[]; readonly radiators: readonly string[]};
  readonly view: unknown;
}

/** What the current app shows from `storage`, in plain data. */
export function summaryOf(storage: ListableStorage): StoreSummary {
  const projects = projectRepoOn(engine, noFiles, storage, 'http://golden.invalid');
  const drivers = myDriverRepoOn(storage, engine).read();
  const radiators = myPassiveRadiatorRepoOn(storage).read();
  const settings = appSettingsRepoOn(storage);
  const prefs = createPrefsRepo(storage);
  const session = projects.loadOpenProjects();
  return {
    projects: projects.listStoredProjects().map(p => ({
      id: p.id, name: p.name, modified: p.modified, summary: p.kind === 'readable' ? p.summary.driver + ' · ' + p.summary.boxType : '',
    })),
    drivers: drivers.kind === 'ok' ? drivers.drivers.map(d => ({uuid: d.uuid, driver: `${d.driver.brand.value} ${d.driver.model.value}`})) : [],
    radiators: radiators.kind === 'ok'
      ? radiators.passiveRadiators.map(r => ({uuid: r.uuid, radiator: `${r.passiveRadiator.brand.value} ${r.passiveRadiator.model.value}`}))
      : [],
    openSession: session === null || Array.isArray(session) ? null : {
      names: session.projects.map(p => p.name.value),
      focused: session.projects[session.focusedIndex]?.name.value ?? null,
      traceHidden: session.projects.filter(p => session.traceHidden.has(p)).map(p => p.name.value),
    },
    settings: {vented: settings.ventedLimits(), env: settings.envDefaults(), differenceCues: settings.differenceCuesShown()},
    favourites: {drivers: prefs.favorites(), radiators: prefs.favoritePassiveRadiators()},
    view: viewStateRepoOn(storage).load(),
  };
}

/** `.owpr` text read and written again through the domain, as every loader does. */
function rewrittenProject(text: string): string {
  const read = OpenISDProject.fromOwprText(text, engine);
  return Array.isArray(read) ? text : read.toOwprText();
}

/** Load every record in `storage` through the current loaders and write it back, in place. A store
 *  whose layout is current comes out exactly as it went in; one whose loaders now write
 *  something else is the signal that STORAGE_LAYOUT needs a bump. */
export function writeBack(storage: ListableStorage): void {
  const drivers = myDriverRepoOn(storage, engine);
  const driverRead = drivers.read();
  if (driverRead.kind === 'ok') for (const d of driverRead.drivers) drivers.upsert(d.driver, d.uuid);

  const radiators = myPassiveRadiatorRepoOn(storage);
  const radiatorRead = radiators.read();
  if (radiatorRead.kind === 'ok') for (const r of radiatorRead.passiveRadiators) radiators.upsert(r.passiveRadiator, r.uuid);

  const settings = appSettingsRepoOn(storage);
  if (storage.get('openisd_app_settings') !== null) {
    settings.setVentedLimits(settings.ventedLimits());
    settings.setEnvDefaults(settings.envDefaults());
    settings.setDifferenceCuesShown(settings.differenceCuesShown());
  }

  const prefs = createPrefsRepo(storage);
  if (storage.get('openisd_favourite_drivers') !== null) prefs.setFavorites(prefs.favorites());
  if (storage.get('openisd_favourite_passive_radiators') !== null) prefs.setFavoritePassiveRadiators(prefs.favoritePassiveRadiators());

  const view = viewStateRepoOn(storage);
  const shown = storage.get(OPENISD_VIEW_KEY) === null ? null : view.load();
  if (shown !== null) view.save(shown);

  const projectsText = storage.get(OPENISD_PROJECTS_KEY);
  if (projectsText !== null) {
    const payload = storedProjectsPayload(JSON.parse(projectsText));
    if (payload !== null) {
      storage.set(OPENISD_PROJECTS_KEY, JSON.stringify({entries: payload.entries.map(e => ({...e, text: rewrittenProject(e.text)}))}));
    }
  }
  const stateText = storage.get(OPENISD_STATE_KEY);
  if (stateText !== null) storage.set(OPENISD_STATE_KEY, rewrittenProject(stateText));
  const sessionText = storage.get(OPENISD_OPEN_SESSIONS_KEY);
  if (sessionText !== null) {
    const parsed: unknown = JSON.parse(sessionText);
    if (typeof parsed === 'object' && parsed !== null && 'entries' in parsed && Array.isArray(parsed.entries)) {
      const entries: unknown[] = parsed.entries;
      storage.set(OPENISD_OPEN_SESSIONS_KEY, JSON.stringify({
        ...parsed,
        entries: entries.map(e => typeof e === 'object' && e !== null && 'text' in e && typeof e.text === 'string' ? {...e, text: rewrittenProject(e.text)} : e),
      }));
    }
  }
}

export function aDriverFromFile(text: string): string {
  const driver = OpenISDDriver.fromOwdrText(text, engine);
  return Array.isArray(driver) ? `unreadable: ${driver.join('; ')}` : `${driver.brand.value} ${driver.model.value}`;
}

export function aProjectFromFile(text: string): string {
  const project = OpenISDProject.fromOwprText(text, engine);
  return Array.isArray(project) ? `unreadable: ${project.join('; ')}` : `${project.name.value} · ${project.box.boxType.value}`;
}

/** `text` (an `.owpr`) with the driver id the domain mints afresh on every read blanked, so two
 *  reads of one project compare equal. */
function withoutMintedDriverId(text: string): string {
  const read = OpenISDProject.fromOwprText(text, engine);
  if (Array.isArray(read)) return text;
  const blank = (node: unknown): void => {
    if (typeof node !== 'object' || node === null) return;
    if (Array.isArray(node)) { node.forEach(blank); return; }
    if ('driverEmbedding' in node && typeof node.driverEmbedding === 'object' && node.driverEmbedding !== null
      && 'device' in node.driverEmbedding && typeof node.driverEmbedding.device === 'object' && node.driverEmbedding.device !== null
      && 'uuid' in node.driverEmbedding.device && typeof node.driverEmbedding.device.uuid === 'object' && node.driverEmbedding.device.uuid !== null) {
      Object.defineProperty(node.driverEmbedding.device.uuid, 'value', {value: '', enumerable: true, writable: true});
    }
    Object.values(node).forEach(blank);
  };
  const parsed: unknown = JSON.parse(read.toOwprText());
  blank(parsed);
  return JSON.stringify(parsed, null, 2);
}

/** A dump with every project text's minted driver id blanked: how two dumps are compared when one
 *  went through a load. Every other byte must match. */
export function withoutMintedIds(dump: Dump): Dump {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(dump)) {
    if (key === OPENISD_STATE_KEY) { out[key] = withoutMintedDriverId(value); continue; }
    if (key === OPENISD_PROJECTS_KEY || key === OPENISD_OPEN_SESSIONS_KEY) {
      const parsed: unknown = JSON.parse(value);
      if (typeof parsed === 'object' && parsed !== null && 'entries' in parsed && Array.isArray(parsed.entries)) {
        const entries: unknown[] = parsed.entries;
        out[key] = JSON.stringify({
          ...parsed,
          entries: entries.map(e => typeof e === 'object' && e !== null && 'text' in e && typeof e.text === 'string' ? {...e, text: withoutMintedDriverId(e.text)} : e),
        });
        continue;
      }
    }
    out[key] = value;
  }
  return out;
}
