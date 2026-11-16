/**
 * The passive-radiator editor (John, 16 Nov 2026: 11:05 UTC QO946.c115; 11:42 "the same select info edit setup and workflow as
 * the driver"; 12:46 "looks ok"): one editor, both skins, for the radiator's own figures (name, Vas, Qms, Fs, Sd, Mms, Cms, Rms,
 * Xmax), with the driver editor's tools. It edits a copy: OK hands the copy to whoever opened it (the project's radiator, or the
 * New Project wizard's), Cancel drops it, Reset puts back what it opened with, Copy to My PRs files a copy in My passive
 * radiators and leaves the editor open, Export and Import write and read an `.owdr` file, Auto calculate unknowns fills the
 * figures the typed ones give, Inspect Provenance says how a figure is worked out. The build choices (count, added mass,
 * tuning) are the project's, never here (QO946.c38).
 */
import {computed, ref, shallowRef, triggerRef} from 'vue';
import type {ComputedRef, Ref} from 'vue';
import {OpenISDPassiveRadiatorStandalone} from '@openisd/design';
import type {MyPassiveRadiatorRepo} from '@openisd/persistence';
import {type EnvironmentEngine, FixedAir, type PrEngine} from '@openisd/design/engine';
import {isoDay, NumberField} from '@openisd/design/fields';
import type {ClearableUICell} from '../ui/components/uiFieldBinding.js';
import type {PassiveRadiatorStepCells} from './OriginalNewProject-hooks.js';
import {PROVENANCE_MAP} from '../logic/provenance.js';
import type {DesignFiles} from '../logic/fileImportExport.js';
import type {FileStorage} from '@openisd/persistence';
import type {Logging} from '../logging/flash.js';
import {DriverFileFormat} from '../fileFormat.js';

/** Where Export writes and Import reads, and how the editor says what it did. */
export interface PassiveRadiatorFiles {
  /** Writes the radiator to a file the user places; the name written, or null when they cancelled. */
  save(pr: OpenISDPassiveRadiatorStandalone, fileName: string): Promise<string | null>;
  /** A file's text as a radiator, or the reasons it could not be read. */
  read(text: string): OpenISDPassiveRadiatorStandalone | string[];
  flash(message: string): void;
}

export interface PassiveRadiatorEditorDeps {
  readonly myPassiveRadiators: MyPassiveRadiatorRepo;
  /** Fills the figures the stated ones give; called after every typed figure while Auto calculate unknowns is on. */
  resolve(pr: OpenISDPassiveRadiatorStandalone): void;
  /** Export and Import; without it they say they cannot. */
  readonly files?: PassiveRadiatorFiles;
}

/** What OK does with the edited radiator. */
export type ApplyRadiator = (pr: OpenISDPassiveRadiatorStandalone) => void;

/** The figure keys the editor shows, in the radiator record's own names. */
export type PassiveRadiatorFigure = keyof PassiveRadiatorStepCells;

/** Inspect Provenance's card: the inspected figure, whether it is typed or worked out, and the formulas that give it. */
export interface PassiveRadiatorProvenance {
  readonly key: PassiveRadiatorFigure;
  readonly label: string;
  readonly state: 'Entered' | 'Calculated' | 'Not available';
  readonly formulas: readonly string[];
  /** The figures those formulas read, tinted in the editor. */
  readonly inputs: readonly string[];
}

/** The radiator record's General fields, as the driver editor's General tab (John, 16 Nov 2026 14:03). */
export interface PassiveRadiatorIdentity {
  readonly manufacturer: string;
  readonly brand: string;
  /** The radiator's name in the app (the page's "Passive radiator" box). */
  readonly model: string;
  readonly providedBy: string;
  readonly added: string;
  readonly comment: string;
}
export type PassiveRadiatorIdentityKey = keyof PassiveRadiatorIdentity;

/** What the editor dialog binds: no domain value crosses into the component (A9). */
export interface PassiveRadiatorEditorView {
  /** The editor's figure boxes; null while the editor is closed. */
  readonly cells: Readonly<Ref<PassiveRadiatorStepCells | null>>;
  readonly title: Readonly<Ref<string>>;
  readonly name: Readonly<Ref<string>>;
  /** What the last Copy to My PRs did, shown in the editor; null before a copy. */
  readonly savedNote: Readonly<Ref<string | null>>;
  /** Copy to My PRs needs a name: the radiator is filed and listed under it. */
  readonly canSave: ComputedRef<boolean>;
  /** Counts Copy to My PRs writes, so a list of the library can re-read it. */
  readonly savedRevision: Readonly<Ref<number>>;
  readonly autoCalculate: Readonly<Ref<boolean>>;
  readonly inspect: Readonly<Ref<boolean>>;
  /** The inspected figure's card; null while Inspect Provenance is off or nothing is picked. */
  readonly provenance: ComputedRef<PassiveRadiatorProvenance | null>;
  readonly identity: ComputedRef<PassiveRadiatorIdentity>;
  setIdentity(key: PassiveRadiatorIdentityKey, value: string): void;
  setName(name: string): void;
  ok(): void;
  cancel(): void;
  reset(): void;
  saveToMyPRs(): void;
  setAutoCalculate(on: boolean): void;
  setInspect(on: boolean): void;
  inspectField(key: PassiveRadiatorFigure): void;
  exportFile(): Promise<void>;
  /** Reads a file's text into the editor (Import). */
  importText(fileName: string, text: string): void;
}

export interface PassiveRadiatorEditor extends PassiveRadiatorEditorView {
  /** Opens the editor on a copy of `source`; OK hands the edited copy to `apply`. */
  open(source: OpenISDPassiveRadiatorStandalone, title: string, apply: ApplyRadiator): void;
}

/** The app's own Export and Import for a radiator: an `.owdr` file through the system save dialog, as the driver editor's. */
export interface AppPassiveRadiatorFilesDeps {
  readonly designFiles: DesignFiles;
  readonly driverFileStorage: FileStorage;
  readonly logging: Logging;
}
export function appPassiveRadiatorFiles({designFiles, driverFileStorage, logging}: AppPassiveRadiatorFilesDeps): PassiveRadiatorFiles {
  const f = DriverFileFormat.Owdr;
  return {
    async save(pr, fileName) {
      const r = await driverFileStorage.saveAs(designFiles.passiveRadiatorToOwdrBytes(pr), fileName, f.mime, f.label, '.' + f.value);
      return r.cancelled ? null : (r.name ?? fileName);
    },
    read: text => designFiles.passiveRadiatorFromText(text),
    flash: message => logging.flash(message),
  };
}

/** The engine areas the editor's calculated figures come from. */
export interface RadiatorEngineAreas {
  readonly pr: PrEngine;
  readonly environment: EnvironmentEngine;
}

/** Fills a radiator's calculated figures in the app's default air: a radiator's own figures belong to no project, as the
 *  New Project wizard's copy (OriginalNewProject-hooks `resolveCopy`). */
export function resolveInAppAir(engine: RadiatorEngineAreas): (pr: OpenISDPassiveRadiatorStandalone) => void {
  return pr => pr.resolve(engine.pr, new FixedAir(engine.environment.solve(engine.environment.defaults()).values));
}

type SpecCell = OpenISDPassiveRadiatorStandalone['spec']['Qms'];
type Spec = OpenISDPassiveRadiatorStandalone['spec'];

const FIGURE_LABEL: Readonly<Record<PassiveRadiatorFigure, string>> = {
  Vas_m3: NumberField.PR_VAS_L.label, Qms: NumberField.PR_QMS.label, Fs_hz: NumberField.PR_FS_HZ.label,
  Sd_m2: NumberField.PR_SD_CM2.label, Mms_kg: NumberField.MMS_KG.label, Cms_m_per_N: NumberField.CMS_M_PER_N.label,
  Rms_kg_per_s: NumberField.RMS_KG_PER_S.label, Xmax_m: NumberField.PR_XMAX_MM.label,
};
const FIGURES = Object.keys(FIGURE_LABEL);

/** The radiator's routes to a figure: the driver's formulas that read only the radiator's own figures (a route through
 *  Qes, BL or Re is a driver's, not a radiator's). */
function radiatorRoutes(key: PassiveRadiatorFigure): readonly {readonly formulaText: string; readonly inputs: readonly string[]}[] {
  return (PROVENANCE_MAP[key]?.paths ?? []).filter(p => p.inputs.every(i => FIGURES.includes(i)));
}

function pickCell(spec: Spec, key: PassiveRadiatorFigure): SpecCell {
  return spec[key];
}

export function createPassiveRadiatorEditor({myPassiveRadiators, resolve, files}: PassiveRadiatorEditorDeps): PassiveRadiatorEditor {
  const draft = shallowRef<OpenISDPassiveRadiatorStandalone | null>(null);
  /** What the editor opened with, for Reset. */
  let opened: OpenISDPassiveRadiatorStandalone | null = null;
  const title = ref('');
  const savedNote = ref<string | null>(null);
  const savedRevision = ref(0);
  const autoCalculate = ref(true);
  const inspect = ref(false);
  const inspected = ref<PassiveRadiatorFigure | null>(null);
  let apply: ApplyRadiator | null = null;
  /** The library entry this editing session filed, so a second copy updates it rather than adding another. */
  let savedUuid: string | undefined;

  const copyOf = (pr: OpenISDPassiveRadiatorStandalone) => OpenISDPassiveRadiatorStandalone.wrap(pr.clonePassiveRadiator());

  function cell(pr: OpenISDPassiveRadiatorStandalone, key: PassiveRadiatorFigure): ClearableUICell {
    const shown = () => pickCell(pr.spec, key);
    const settle = () => { if (autoCalculate.value) resolve(pr); triggerRef(draft); };
    return {
      get name() { return shown().name; },
      get value() { return shown().value; },
      get provenance() { return shown().provenance; },
      get dq() { return shown().dq; },
      get mandatoryAndUnsatisfied() { return shown().mandatoryAndUnsatisfied; },
      get entered() { return shown().entered; },
      get precision() { return shown().precision; },
      set: (v, precision) => { shown().set(v, precision); settle(); },
      clear: () => { shown().clear(); settle(); },
    };
  }

  const cells = computed<PassiveRadiatorStepCells | null>(() => {
    const pr = draft.value;
    if (pr === null) return null;
    return {
      Vas_m3: cell(pr, 'Vas_m3'), Qms: cell(pr, 'Qms'), Fs_hz: cell(pr, 'Fs_hz'), Sd_m2: cell(pr, 'Sd_m2'),
      Mms_kg: cell(pr, 'Mms_kg'), Cms_m_per_N: cell(pr, 'Cms_m_per_N'), Rms_kg_per_s: cell(pr, 'Rms_kg_per_s'),
      Xmax_m: cell(pr, 'Xmax_m'),
    };
  });
  const name = computed(() => draft.value?.model.value ?? '');
  const identity = computed<PassiveRadiatorIdentity>(() => {
    const pr = draft.value;
    return {
      manufacturer: pr?.manufacturer.value ?? '', brand: pr?.brand.value ?? '', model: pr?.model.value ?? '',
      providedBy: pr?.providedBy.value ?? '', added: isoDay(pr?.added.value ?? ''), comment: pr?.comment.value ?? '',
    };
  });
  const canSave = computed(() => name.value.trim() !== '');

  const provenance = computed<PassiveRadiatorProvenance | null>(() => {
    const pr = draft.value;
    const key = inspected.value;
    if (pr === null || !inspect.value || key === null) return null;
    const c = pickCell(pr.spec, key);
    const routes = radiatorRoutes(key);
    return {
      key, label: FIGURE_LABEL[key],
      state: c.value === null ? 'Not available' : c.entered ? 'Entered' : 'Calculated',
      formulas: routes.map(r => r.formulaText),
      inputs: [...new Set(routes.flatMap(r => r.inputs))],
    };
  });

  function close(): void {
    draft.value = null; opened = null; apply = null; savedUuid = undefined; savedNote.value = null;
    inspect.value = false; inspected.value = null; autoCalculate.value = true;
  }

  /** The file name a radiator exports to: `<brand> <model>`, as a driver's. */
  function fileBase(pr: OpenISDPassiveRadiatorStandalone): string {
    return [pr.brand.value, pr.model.value].map(t => t.trim()).filter(t => t !== '').join(' ') || 'Passive radiator';
  }

  return {
    cells, title, name, savedNote, canSave, savedRevision, autoCalculate, inspect, provenance, identity,
    setIdentity(key, value) {
      const pr = draft.value;
      if (pr === null) return;
      pr[key].set(value);
      triggerRef(draft);
    },
    open(source, heading, onOk) {
      close();
      const copy = copyOf(source);
      resolve(copy);
      title.value = heading;
      apply = onOk;
      opened = copyOf(copy);
      draft.value = copy;
    },
    setName(text) {
      const pr = draft.value;
      if (pr === null) return;
      pr.model.set(text);
      triggerRef(draft);
    },
    ok() {
      const pr = draft.value;
      const onOk = apply;
      close();
      if (pr !== null && onOk !== null) onOk(pr);
    },
    cancel: close,
    reset() {
      if (opened === null) return;
      draft.value = copyOf(opened);
      savedNote.value = null;
    },
    saveToMyPRs() {
      const pr = draft.value;
      if (pr === null) return;
      if (!canSave.value) { savedNote.value = 'Not copied: give it a name first (General tab); a radiator is filed under its name.'; return; }
      const copy = copyOf(pr);
      copy.model.set(name.value.trim());
      const result = myPassiveRadiators.upsert(copy, savedUuid);
      if (result === null) {
        savedNote.value = 'Not copied: your saved passive radiators cannot be written.';
        return;
      }
      savedUuid = result.uuid;
      savedNote.value = `Copied "${name.value.trim()}" to My passive radiators.`;
      savedRevision.value++;
    },
    setAutoCalculate(on) {
      autoCalculate.value = on;
      const pr = draft.value;
      if (on && pr !== null) { resolve(pr); triggerRef(draft); }
    },
    setInspect(on) {
      inspect.value = on;
      if (!on) inspected.value = null;
    },
    inspectField(key) {
      if (inspect.value) inspected.value = key;
    },
    async exportFile() {
      const pr = draft.value;
      if (pr === null) return;
      if (files === undefined) return;
      const written = await files.save(pr, `${fileBase(pr)}.owdr`);
      if (written !== null) files.flash(`Passive radiator exported as ${written}`);
    },
    importText(fileName, text) {
      if (files === undefined || draft.value === null) return;
      const read = files.read(text);
      if (Array.isArray(read)) { files.flash(`Could not import ${fileName}: ${read[0] ?? 'unreadable'}`); return; }
      const copy = copyOf(read);
      if (autoCalculate.value) resolve(copy);
      draft.value = copy;
      files.flash(`Passive radiator imported from ${fileName}`);
    },
  };
}
