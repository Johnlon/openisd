import type {InjectionKey, Ref} from 'vue';
import {useApp} from '../logic/app.js';
import {computed} from 'vue';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {inputChecked} from '../logic/domEvents.js';
import type {OpenISDProject} from '@openisd/design';

export interface AdvancedOptionsAPI {
  readonly hasVent: Readonly<Ref<boolean>>;
  readonly simVcInductance: Ref<boolean>;
  readonly project: Readonly<Ref<OpenISDProject>>;
  inputChecked(e: Event): boolean;
}

export const AdvancedOptionsKey: InjectionKey<AdvancedOptionsAPI> = Symbol('AdvancedOptionsAPI');

export function useAdvancedOptions(): AdvancedOptionsAPI {
  const {projectChanged, simVcInductance} = useApp().appState;
  const project = useFocusedProject();

  const hasVent = computed(() => {
    void projectChanged.value;
    const b = project.value.box.boxType.value;
    return b === 'vented' || b === 'bandpass4';
  });

  return {
    hasVent,
    simVcInductance,
    project,
    inputChecked,
  };
}
