import type {InjectionKey, Ref} from 'vue';
import {computed} from 'vue';
import {projectChanged, simVcInductance} from '../logic/appState.js';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {fieldHelp} from '../logic/fields/uiFields.js';
import {inputChecked} from '../logic/domEvents.js';
import type {OpenISDProject} from '@openisd/design';

export interface AdvancedOptionsAPI {
  readonly hasVent: Readonly<Ref<boolean>>;
  readonly simVcInductance: Ref<boolean>;
  /** Le is in the acoustic circuit — any model but 'winisd'. */
  readonly inductanceOn: Readonly<Ref<boolean>>;
  /** WinISD-compatible inductance: 'winisdGyrator' when on, textbook 'gyrator' when off. */
  readonly winisdInductance: Ref<boolean>;
  readonly project: Readonly<Ref<OpenISDProject>>;
  applyWinisdSettings(): void;
  fieldHelp(key: string): string;
  inputChecked(e: Event): boolean;
}

export const AdvancedOptionsKey: InjectionKey<AdvancedOptionsAPI> = Symbol('AdvancedOptionsAPI');

export function useAdvancedOptions(): AdvancedOptionsAPI {
  const project = useFocusedProject();

  const hasVent = computed(() => {
    const b = project.value.box.boxType.value;
    return b === 'vented' || b === 'bandpass4';
  });

  // `projectChanged` too: reading `project.value` alone does not re-derive on a project mutation.
  const inductanceOn = computed(() => { void projectChanged.value; return project.value.circuitModel.value !== 'winisd'; });

  const winisdInductance = computed<boolean>({
    get: () => { void projectChanged.value; return project.value.circuitModel.value === 'winisdGyrator'; },
    set: (on) => { project.value.circuitModel.set(on ? 'winisdGyrator' : 'gyrator'); },
  });

  const applyWinisdSettings = () => {
    project.value.applyWinisdSettings();
  };

  return {
    hasVent,
    simVcInductance,
    inductanceOn,
    winisdInductance,
    project,
    applyWinisdSettings,
    fieldHelp,
    inputChecked,
  };
}
