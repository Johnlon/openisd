import type {InjectionKey, Ref} from 'vue';
import {computed} from 'vue';
import {simVcInductance} from '../logic/appState.js';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {fieldHelp} from '../logic/fields/uiFields.js';
import {inputChecked} from '../logic/domEvents.js';
import type {OpenISDProject} from '@openisd/design';

export interface AdvancedOptionsAPI {
  readonly hasVent: Readonly<Ref<boolean>>;
  readonly simVcInductance: Ref<boolean>;
  readonly project: Readonly<Ref<OpenISDProject>>;
  fieldHelp(key: string): string;
  inputChecked(e: Event): boolean;
}

export const AdvancedOptionsKey: InjectionKey<AdvancedOptionsAPI> = Symbol('AdvancedOptionsAPI');

export function useAdvancedOptions(): AdvancedOptionsAPI {
  const project = useFocusedProject();

  const hasVent = computed(() => {
    const b = project.value.box.boxType.get();
    return b === 'vented' || b === 'bandpass4';
  });

  return {
    hasVent,
    simVcInductance,
    project,
    fieldHelp,
    inputChecked,
  };
}
