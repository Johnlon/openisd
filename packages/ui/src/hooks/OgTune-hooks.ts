import type {InjectionKey, Ref} from 'vue';
import {computed} from 'vue';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {ebpOf} from '../logic/environment.js';
import {cellClassFor} from '../logic/useDriverCells.js';
import type {Calculated, Clearable, Entered, Readable, Writable} from '@openisd/design';
import {engine, projectChanged} from '../logic/appState.js';
import type {NumSpecField} from '../logic/appState.js';
import {specFieldHandle} from '../logic/driverSpecFields.js';

export type NumKey = NumSpecField;
export type { NumSpecField };

export interface OgTuneAPI {
  readonly ebp: Readonly<Ref<number | null>>;
  readonly vb_m3: Readonly<Ref<number | null>>;

  specField(key: NumSpecField): Readable<number | null> & Entered & Calculated & Writable<number> & Clearable;
  fieldCell(key: NumSpecField): Readable<number | null> & Entered & Calculated;
  cellClass(key: NumSpecField): string;
  cellVal(key: NumSpecField): number | null;
  dqNote(key: NumSpecField): string | null;

  /** `precision` is what the typed characters STATE, in SI — see `Writable.set`. */
  enterField(key: NumSpecField, v: number, precision?: number): void;
  clearField(key: NumSpecField): void;
  setVb_m3(v: number): void;
  reset(): Promise<void>;
  cancel(): void;
}

export const OgTuneKey: InjectionKey<OgTuneAPI> = Symbol('OgTuneAPI');

export function useOgTune(): OgTuneAPI {
  const project = useFocusedProject();

  function specField(key: NumSpecField): Readable<number | null> & Entered & Calculated & Writable<number> & Clearable {
    const handle = specFieldHandle(project.value.driver, key);
    if (!handle) {
      throw new Error(`specFieldHandle returned null for numeric field ${key}`);
    }
    return handle;
  }

  function fieldCell(key: NumSpecField): Readable<number | null> & Entered & Calculated {
    return specField(key);
  }

  // `projectChanged` as well as `project`: the registry hands out the SAME project instance for
  // its whole life, so `project.value` never invalidates a cached computed after a write. Reading
  // only it froze `vb_m3` at the volume the panel opened with, which NumInput's blur reformat then
  // put back on screen (John, 2026-09-25: "Vb is the only one that's a problem"). Same rule as
  // `createBoxVolume` in `OriginalShell-hooks.ts`.
  const ebp = computed(() => {
    void projectChanged.value; void project.value;
    const ts = project.value.driver.specs;
    const Fs_hz = ts.Fs_hz.value, Qes = ts.Qes.value;
    return Fs_hz != null && Qes != null && Qes !== 0 ? ebpOf(Fs_hz, Qes) : null;
  });

  const vb_m3 = computed<number | null>(() => {
    void projectChanged.value; void project.value;
    const box = project.value.box;
    switch (box.boxType.value) {
      case 'sealed': return box.sealed.volume_m3.value;
      case 'vented': return box.vented.volume_m3.value;
      case 'bandpass4': return box.bandpass4.chambers.rear.volume_m3.value;
      case 'bandpass6': return box.bandpass6.chambers.rear.volume_m3.value;
      case 'abc': return box.abc.chambers.rear.volume_m3.value;
      case 'box-passive-radiator': return box.passiveRadiator.volume_m3.value;
      default: return null;
    }
  });

  function setVb_m3(v: number): void {
    const box = project.value.box;
    switch (box.boxType.value) {
      case 'sealed': box.sealed.volume_m3.set(v); break;
      case 'vented': box.vented.volume_m3.set(v); break;
      case 'bandpass4': box.bandpass4.chambers.rear.volume_m3.set(v); break;
      case 'bandpass6': box.bandpass6.chambers.rear.volume_m3.set(v); break;
      case 'abc': box.abc.chambers.rear.volume_m3.set(v); break;
      case 'box-passive-radiator': box.passiveRadiator.volume_m3.set(v); break;
    }
  }

  function cellClass(key: NumSpecField): string {
    return cellClassFor(fieldCell, key);
  }

  const BAD_VALUE_NOTE = 'Bad data: zero or less is not a physical value here. It is kept and saved exactly as entered — clear the field to let it be calculated instead.';

  function dqNote(key: NumSpecField): string | null {
    const v = fieldCell(key).value;
    if (typeof v === 'number' && !(v > 0)) return BAD_VALUE_NOTE;
    // Each issue rendered by the engine — the one place a `DqIssue` becomes a sentence, and the
    // same one the driver editor reads through (`dqNoteFor`). Joining the issues themselves put
    // "[object Object]" in the tooltip, which nothing noticed while this panel's dq was always
    // empty (the marks were computed and then discarded with the rebuilt embedded driver).
    return fieldCell(key).dq.map(issue => engine.dqIssueText(issue)).join('\n');
  }

  function cellVal(key: NumSpecField): number | null {
    const v = fieldCell(key).value;
    return typeof v === 'number' ? v : null;
  }

  function enterField(key: NumSpecField, v: number, precision?: number): void {
    specField(key).set(v, precision);
  }

  function clearField(key: NumSpecField): void {
    specField(key).clear();
  }

  function cancel() {
    project.value.cancelWhatIf();
  }

  async function reset(): Promise<void> {
    project.value.resetWhatIf();
  }

  return {
    ebp,
    vb_m3,
    specField,
    fieldCell,
    cellClass,
    cellVal,
    dqNote,
    enterField,
    clearField,
    setVb_m3,
    cancel,
    reset,
  };
}
