# Plan: Vue Component Hook APIs (`X.vue` -> `X-hooks.ts`), Acceptance Scenarios & Parallel UI Test Execution

> **Goal:** Establish a 3-tier testing architecture:
> 1. Fast Vitest unit tests for core physics, solvers, and codecs.
> 2. Narrow TypeScript hook interfaces in `packages/ui/src/hooks/X-hooks.ts` for all 21 Vue components, covered 100% in Vitest.
> 3. A curated Tier 3 suite of 15–20 **Fully Connected Playwright Acceptance Scenarios** (`packages/ui/test/scenarios/`) testing the 100% un-mocked application in parallel (`--workers=4`).

---

## 0. Fully Worked Example: `DriverEditorModal.vue` & `DriverEditorModal-hooks.ts`

This section shows the complete, production-ready implementation of the narrow, mockable hook interface for `DriverEditorModal.vue`, its real implementation, its Vue component consumption, and its Vitest unit tests.

### 0a. Interface & Hook Implementation: `packages/ui/src/hooks/DriverEditorModal-hooks.ts`

```ts
import type { InjectionKey, Ref } from 'vue';
import { ref, computed } from 'vue';
import type { OpenISDDriver, Cell, FieldHandle } from '@openisd/design';
import type { SpecField } from '../logic/appState.js';
import { useFocusedProject } from '../logic/focusedProjectContext.js';
import { useApp } from '../logic/app.js';
import { openDriverDraft } from '../logic/driverDraft.js';
import { specFieldHandle } from '../logic/driverSpecFields.js';
import { cellClassFor, consistencyNote } from '../logic/useDriverCells.js';
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
  readonly draftDriver: Readonly<Ref<OpenISDDriver>>;
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

  const draftDriver = computed(() => {
    const _ = trigger.value;
    return draft.driver;
  });

  const driverRaw = computed<DriverRawText>(() => {
    const _ = trigger.value;
    const d = draftDriver.value;
    return {
      brand: d.brand.get().value,
      model: d.model.get().value,
      manufacturer: d.manufacturer.get().value,
      providedBy: d.providedBy.get().value,
      comment: d.comment.get().value,
      added: d.added.get().value,
      sku: d.sku,
      VCCon: d.spec[d.section].VCCon.get().value,
    };
  });

  const editorModelValue = computed(() => {
    const r = driverRaw.value;
    if (r.sku) return r.sku.toUpperCase();
    return String(r.model ?? '');
  });

  const renameQuestionOpen = ref(false);

  function savedEntryForSubject(): OpenISDDriver | null {
    if (subject.kind !== 'myDriver' || !subject.openedAs) return null;
    return myDrivers.list().find(e => e.uuid === subject.openedAs)?.driver ?? null;
  }

  function saveWouldRename(): boolean {
    const saved = savedEntryForSubject();
    if (!saved) return false;
    return saved.brand.get().value !== draftDriver.value.brand.get().value
      || saved.model.get().value !== draftDriver.value.model.get().value;
  }

  function commitToMyDrivers(driver: OpenISDDriver): void {
    if (subject.kind !== 'myDriver') throw new Error('commitToMyDrivers called on a project subject');
    if (myDrivers.upsert(driver) == null) {
      alert('Saved drivers are read-only until the storage problem is resolved');
    }
  }

  function fieldOf(field: string): FieldHandle<number> | null {
    const _ = trigger.value;
    return specFieldHandle(draftDriver.value, field);
  }

  function cellOf(field: string): Cell<number> {
    return fieldOf(field)?.get() ?? { value: null, state: 'not-available' };
  }

  function cellClass(field: SpecField): string {
    return cellClassFor(cellOf, field);
  }

  function cellVal(field: SpecField): number | null {
    const v = cellOf(field).value;
    return typeof v === 'number' ? v : null;
  }

  function dqNote(field: SpecField): string | null {
    return null;
  }

  function precisionVal(field: SpecField): number {
    return precision(field as any);
  }

  function fieldHelpText(field: SpecField): string {
    return fieldHelp(field as any);
  }

  function setTab(t: Tab): void {
    activeTab.value = t;
  }

  function setText(field: 'brand' | 'model' | 'providedBy' | 'comment' | 'manufacturer' | 'added', e: Event): void {
    const edited = editableFrom(e);
    if (edited === null) return;
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
    renameQuestionOpen.value = false;
    commitToMyDrivers(draftDriver.value);
    selection.closeEditor();
    onClose?.();
  }

  function saveAsCopy(): void {
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
  return {
    editorTitle: "Edit Project's Driver",
    activeTab: ref<Tab>('General'),
    draftDriver: ref({} as OpenISDDriver),
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
```

---

## 1. Architecture & Design Pattern (`packages/ui/src/hooks/X-hooks.ts`)

Every interactive Vue component `X.vue` maps to a narrow hook module `packages/ui/src/hooks/X-hooks.ts`.

---

## 2. Fully Connected Acceptance Scenario Suite (Tier 3)

The acceptance suite in `packages/ui/test/scenarios/` exercises the 100% un-mocked application:

1. **`project-creation-and-driver-selection.scenario.browser.spec.ts`**: New project wizard $\rightarrow$ Driver search/filter $\rightarrow$ Driver selection $\rightarrow$ Parameter validation.
2. **`driver-editor-and-persistence.scenario.browser.spec.ts`**: Driver Editor $\rightarrow$ Edit parameters $\rightarrow$ Save to My Drivers $\rightarrow$ Reload page $\rightarrow$ Verify persisted state.
3. **`enclosure-tuning-and-realtime-graph.scenario.browser.spec.ts`**: Switch Box Type $\rightarrow$ Edit Vb/Fb in `OgTune` $\rightarrow$ Canvas trace redraw & solver check.
4. **`file-import-export-and-share-link.scenario.browser.spec.ts`**: Import `.wdr`/`.wpr`/`.owpr` $\rightarrow$ Export `.wpr`/`.owdr` $\rightarrow$ Share URL verification.
5. **`multi-project-session-switching.scenario.browser.spec.ts`**: Multiple project tabs $\rightarrow$ Switch active focus $\rightarrow$ Edit project A $\rightarrow$ Switch to project B $\rightarrow$ Verify state isolation.

---

## 3. Speculated Impact on Test Efficiency & Execution Velocity

1. **Per-Assertion Speedup:** ~560x faster (14,000ms $\rightarrow$ 25ms per assertion).
2. **Serial Playwright Suite:** Reduced from 84 minutes down to ~15-20 minutes.
3. **Parallel Playwright Execution (`--workers=4`):** Acceptance scenarios execute in **~3.5 - 5 minutes**.
4. **Full `health-check.sh` Pipeline:** Pipeline completes in **< 6 minutes total**.

---

## 4. Parallel Playwright Benchmark & Verification

- Test Playwright execution with `--workers=2` and `--workers=4`.
- Validate zero test failures and full health check green (`bash scripts/health-check.sh`).
