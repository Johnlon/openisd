import type {InjectionKey, Ref} from 'vue';
import {computed} from 'vue';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {cellClassFor} from '../logic/useDriverCells.js';
import type {Calculated, Clearable, Entered, Readable, Writable} from '@openisd/design';
import type {NumSpecField} from '../logic/appState.js';
import {engine, projectChanged} from '../logic/appState.js';

export type NumKey = NumSpecField;
export type { NumSpecField };

export interface OgTuneAPI {
  readonly ebp: Readonly<Ref<number | null>>;
  readonly vb_m3: Readonly<Ref<number | null>>;

  specField(key: NumSpecField): Readable<number | null> & Entered & Calculated & Writable<number> & Clearable;
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

  function specField(key: NumSpecField):
      Readable<number | null> & Entered & Calculated & Writable<number> & Clearable {
    return project.value.driver.specField(key);
  }

  // `projectChanged` as well as `project`: the registry hands out the SAME project instance for
  // its whole life, so `project.value` never invalidates a cached computed after a write. Reading
  // only it froze `vb_m3` at the volume the panel opened with, which NumInput's blur reformat then
  // put back on screen (John, 2026-09-25: "Vb is the only one that's a problem"). Same rule as
  // `createBoxVolume` in `boxFields.ts`.
  const ebp = computed(() => {
    void projectChanged.value; void project.value;
    const ts = project.value.driver.specs;
    const Fs_hz = ts.Fs_hz.value, Qes = ts.Qes.value;
    return Fs_hz != null && Qes != null && Qes !== 0 ? engine.ebp(Fs_hz, Qes) : null;
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
    return cellClassFor(specField, key);
  }

  /** A bad value (≤ 0, non-finite) is marked by the DOMAIN, on the field's own `.dq`
   *  (`Engine.positiveValueIssue`, BUG_20260927_driver-bad-value-decided-in-ui.md) — this reads
   *  that mark, never judges the value itself, same as the driver editor's own `dqNoteFor`.
   *  Each issue carries its own sentence. Joining the issues themselves put "[object Object]"
   *  in the tooltip, which nothing noticed while this panel's dq was always empty (the marks
   *  were computed and then discarded with the rebuilt embedded driver). */
  function dqNote(key: NumSpecField): string | null {
    return specField(key).dq.map(issue => issue.text).join('\n');
  }

  function cellVal(key: NumSpecField): number | null {
    const v = specField(key).value;
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
