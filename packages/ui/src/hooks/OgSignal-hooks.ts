import type { InjectionKey, Ref } from 'vue';
import { computed } from 'vue';
import { useFocusedProject } from '../logic/focusedProjectContext.js';
import type { OpenISDProject } from '@openisd/design';

export interface OgSignalAPI {
  readonly project: Readonly<Ref<OpenISDProject>>;
  readonly voltage_V: Readonly<Ref<number | null>>;
  readonly power_W: Readonly<Ref<number | null>>;
  setVoltage(v: number): void;
  setPower(p: number): void;
}

export const OgSignalKey: InjectionKey<OgSignalAPI> = Symbol('OgSignalAPI');

export function useOgSignal(): OgSignalAPI {
  const project = useFocusedProject();
  const voltage_V = computed(() => project.value.statedVoltage_V.value);
  const power_W = computed(() => project.value.powerDrive_W.value);

  function setVoltage(v: number): void {
    project.value.setDriveVoltage_V(v);
  }

  function setPower(p: number): void {
    project.value.setPowerDrive_W(p);
  }

  return {
    project,
    voltage_V,
    power_W,
    setVoltage,
    setPower,
  };
}
