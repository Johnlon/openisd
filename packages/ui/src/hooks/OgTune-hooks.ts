import type {InjectionKey, Ref} from 'vue';
import {computed} from 'vue';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {ebpOf} from '../logic/environment.js';
import {cellClassFor} from '../logic/useDriverCells.js';
import type {Cell, Field} from '@openisd/design';
import type {NumSpecField} from '../logic/appState.js';
import {specFieldHandle} from '../logic/driverSpecFields.js';

export type NumKey = NumSpecField;
export type { NumSpecField };

export interface OgTuneAPI {
  readonly ebp: Readonly<Ref<number | null>>;

  specField(key: NumSpecField): Field<number>;
  fieldCell(key: NumSpecField): Cell<number>;
  cellClass(key: NumSpecField): string;
  cellVal(key: NumSpecField): number | null;
  dqNote(key: NumSpecField): string | null;

  enterField(key: NumSpecField, v: number): void;
  clearField(key: NumSpecField): void;
}

export const OgTuneKey: InjectionKey<OgTuneAPI> = Symbol('OgTuneAPI');

export function useOgTune(): OgTuneAPI {
  const project = useFocusedProject();

  function specField(key: NumSpecField): Field<number> {
    const handle = specFieldHandle(project.value.driver, key);
    if (!handle) {
      throw new Error(`specFieldHandle returned null for numeric field ${key}`);
    }
    return handle;
  }

  function fieldCell(key: NumSpecField): Cell<number> {
    return specField(key).get();
  }

  const ebp = computed(() => {
    const fs = fieldCell('Fs_hz').value;
    const qes = fieldCell('Qes').value;
    return fs != null && qes != null ? ebpOf(fs, qes) : null;
  });

  function cellClass(key: NumSpecField): string {
    return cellClassFor(fieldCell, key);
  }

  function dqNote(key: NumSpecField): string | null {
    return fieldCell(key).dq().join('\n');
  }

  function cellVal(key: NumSpecField): number | null {
    const v = fieldCell(key).value;
    return typeof v === 'number' ? v : null;
  }

  function enterField(key: NumSpecField, v: number): void {
    specField(key).set(v);
  }

  function clearField(key: NumSpecField): void {
    specField(key).clear();
  }

  return {
    ebp,
    specField,
    fieldCell,
    cellClass,
    cellVal,
    dqNote,
    enterField,
    clearField,
  };
}
