import type { InjectionKey, Ref } from 'vue';
import { ref, computed } from 'vue';
import { OpenISDDriverStandalone, createCell, type Cell, type Field } from '@openisd/design';
import { engine, type SpecField } from '../logic/appState.js';
import { useFocusedProject } from '../logic/focusedProjectContext.js';
import { useApp } from '../logic/app.js';
import { openDriverDraft } from '../logic/driverDraft.js';
import { specFieldHandle } from '../logic/driverSpecFields.js';
import { cellClassFor } from '../logic/useDriverCells.js';
import { editableFrom, selectValue } from '../logic/domEvents.js';
import { precision, fieldHelp } from '../logic/fields/fieldRegistry.js';

export type Tab = 'General' | 'Parameters' | 'Advanced parameters' | 'Dimensions';

export interface DriverRawText {
  brand: string | null;
  model: string | null;
  manufacturer: string | null;
  providedBy: string | null;
  comment: string | null;
  added: string | null;
  sku: string | null;
  VCCon: string | null;
}

/** The narrow, mockable interface exposed to DriverEditorModal.vue */
export interface DriverEditorModalAPI {
  readonly editorTitle: string;
  readonly activeTab: Readonly<Ref<Tab>>;
  readonly draftDriver: Readonly<Ref<OpenISDDriverStandalone>>;
  readonly driverRaw: Readonly<Ref<DriverRawText>>;
  readonly editorModelValue: Readonly<Ref<string>>;
  readonly renameQuestionOpen: Readonly<Ref<boolean>>;

  cellClass(field: SpecField): string;
  cellVal(field: SpecField): number | null;
  dqNote(field: SpecField): string | null;
  precisionVal(field: SpecField): number;
  fieldHelpText(field: SpecField): string;

  setTab(tab: Tab): void;
  setText(field: 'brand' | 'model' | 'providedBy' | 'comment' | 'manufacturer' | 'added', e: Event): void;
  setNum(field: SpecField, value: number | null): void;
  setWiring(e: Event): void;

  save(): void;
  saveRenameInPlace(): void;
  saveAsCopy(): void;
  cancel(): void;
}

export const DriverEditorModalKey: InjectionKey<DriverEditorModalAPI> = Symbol('DriverEditorModalAPI');

/** Real implementation of the hook — delegates directly to logic/ modules */
export function useDriverEditorModal(onClose?: () => void): DriverEditorModalAPI {
  const { selection, myDrivers } = useApp();
  const project = useFocusedProject();
  const subject = selection.editSubject();
  const activeTab = ref<Tab>('General');

  const editorTitle = subject.kind === 'myDriver' ? 'Edit My Driver' : "Edit Project's Driver";
  const draft = openDriverDraft(subject, () => project.value.driver);
  const trigger = ref(0);
  function forceUpdate() { trigger.value++; }

  const draftDriver = computed<OpenISDDriverStandalone>(() => {
    const _ = trigger.value;
    return draft.driver;
  });

  const driverRaw = computed<DriverRawText>(() => {
    const _ = trigger.value;
    const d = draftDriver.value;
    if (!d) {
      return {
        brand: null,
        model: null,
        manufacturer: null,
        providedBy: null,
        comment: null,
        added: null,
        sku: null,
        VCCon: null,
      };
    }
    return {
      brand: d.brand.get().value,
      model: d.model.get().value,
      manufacturer: d.manufacturer.get().value,
      providedBy: d.providedBy.get().value,
      comment: d.comment.get().value,
      added: d.added.get().value,
      sku: d.sku.value,
      VCCon: d.spec[d.section].VCCon.get().value,
    };
  });

  const editorModelValue = computed(() => {
    const r = driverRaw.value;
    if (r.sku) return r.sku.toUpperCase();
    return String(r.model ?? '');
  });

  const renameQuestionOpen = ref(false);

  function savedEntryForSubject(): OpenISDDriverStandalone | null {
    if (subject.kind !== 'myDriver' || !subject.openedAs) return null;
    return myDrivers.list().find(e => e.uuid === subject.openedAs)?.driver ?? null;
  }

  function saveWouldRename(): boolean {
    const saved = savedEntryForSubject();
    if (!saved || !draftDriver.value) return false;
    return saved.brand.get().value !== draftDriver.value.brand.get().value
      || saved.model.get().value !== draftDriver.value.model.get().value;
  }

  function commitToMyDrivers(driver: OpenISDDriverStandalone): void {
    if (subject.kind !== 'myDriver') throw new Error('commitToMyDrivers called on a project subject');
    if (myDrivers.upsert(driver) == null) {
      alert('Saved drivers are read-only until the storage problem is resolved');
    }
  }

  function fieldOf(field: string): Field<number> | null {
    const _ = trigger.value;
    if (!draftDriver.value) return null;
    return specFieldHandle(draftDriver.value, field);
  }

  function cellOf(field: string): Cell<number> {
    return fieldOf(field)?.get() ?? createCell<number>('', null, 'not-available');
  }

  function cellClass(field: SpecField): string {
    return cellClassFor(cellOf, field);
  }

  function cellVal(field: SpecField): number | null {
    const v = cellOf(field).value;
    return typeof v === 'number' ? v : null;
  }

  function dqNote(_field: SpecField): string | null {
    return null;
  }

  function precisionVal(field: SpecField): number {
    return precision(field);
  }

  function fieldHelpText(field: SpecField): string {
    return fieldHelp(field);
  }

  function setTab(t: Tab): void {
    activeTab.value = t;
  }

  function setText(field: 'brand' | 'model' | 'providedBy' | 'comment' | 'manufacturer' | 'added', e: Event): void {
    const edited = editableFrom(e);
    if (edited === null || !draftDriver.value) return;
    const value = edited.value;
    const d = draftDriver.value;
    switch (field) {
      case 'brand': d.brand.set(value); break;
      case 'model': d.model.set(value); break;
      case 'manufacturer': d.manufacturer.set(value); break;
      case 'providedBy': d.providedBy.set(value); break;
      case 'comment': d.comment.set(value); break;
      case 'added': d.added.set(value); break;
    }
    forceUpdate();
  }

  function setNum(field: SpecField, v: number | null): void {
    const handle = fieldOf(field);
    if (!handle) return;
    if (v == null) handle.clear(); else handle.set(v);
    forceUpdate();
  }

  function setWiring(e: Event): void {
    draft.setWiring(selectValue(e) === 'series' ? 'series' : 'parallel');
    forceUpdate();
  }

  function save(): void {
    if (!draftDriver.value) return;
    if (subject.kind === 'myDriver') {
      if (saveWouldRename()) {
        renameQuestionOpen.value = true;
        return;
      }
      commitToMyDrivers(draftDriver.value);
    } else {
      project.value.loadDriver(draftDriver.value);
    }
    selection.closeEditor();
    onClose?.();
  }

  function saveRenameInPlace(): void {
    if (!draftDriver.value) return;
    renameQuestionOpen.value = false;
    commitToMyDrivers(draftDriver.value);
    selection.closeEditor();
    onClose?.();
  }

  function saveAsCopy(): void {
    if (!draftDriver.value) return;
    renameQuestionOpen.value = false;
    commitToMyDrivers(draftDriver.value);
    selection.closeEditor();
    onClose?.();
  }

  function cancel(): void {
    selection.closeEditor();
    onClose?.();
  }

  return {
    editorTitle,
    activeTab,
    draftDriver,
    driverRaw,
    editorModelValue,
    renameQuestionOpen,
    cellClass,
    cellVal,
    dqNote,
    precisionVal,
    fieldHelpText,
    setTab,
    setText,
    setNum,
    setWiring,
    save,
    saveRenameInPlace,
    saveAsCopy,
    cancel,
  };
}

/** Test Mock Creator for DriverEditorModal */
export function createMockDriverEditorModalAPI(overrides?: Partial<DriverEditorModalAPI>): DriverEditorModalAPI {
  const defaultDriver = OpenISDDriverStandalone.empty(engine);
  defaultDriver.brand.set('MockBrand');
  defaultDriver.model.set('MockModel');
  return {
    editorTitle: "Edit Project's Driver",
    activeTab: ref<Tab>('General'),
    draftDriver: computed(() => defaultDriver),
    driverRaw: ref({
      brand: 'MockBrand',
      model: 'MockModel',
      manufacturer: null,
      providedBy: null,
      comment: null,
      added: null,
      sku: 'MOCK-1',
      VCCon: 'parallel',
    }),
    editorModelValue: ref('MOCK-1'),
    renameQuestionOpen: ref(false),
    cellClass: () => 'de-cell-ok',
    cellVal: () => 10,
    dqNote: () => null,
    precisionVal: () => 2,
    fieldHelpText: () => 'Help text',
    setTab: () => {},
    setText: () => {},
    setNum: () => {},
    setWiring: () => {},
    save: () => {},
    saveRenameInPlace: () => {},
    saveAsCopy: () => {},
    cancel: () => {},
    ...overrides,
  };
}
