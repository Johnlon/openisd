import type {InjectionKey, Ref} from 'vue';
import {computed} from 'vue';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {useApp} from '../logic/app.js';
import {projectChanged} from '../logic/appState.js';
import {inputValue} from '../logic/domEvents.js';
import {NumberField, type SelectorOption} from '@openisd/design/fields';

export interface PREditModalAPI {
  readonly radiator: Readonly<Ref<ReturnType<typeof useFocusedProject>['value']['box']['passiveRadiator']['radiator']>>;
  readonly prFsWithMassShown: Readonly<Ref<number | null>>;
  readonly count: Readonly<Ref<number>>;
  /** The PR count picker's choices (1–4). */
  readonly countOptions: readonly SelectorOption<number>[];
  setCount(v: number): void;
  saveCurrentPR(): void;
  close(): void;
  inputValue(e: Event): string;
}

export const PREditModalKey: InjectionKey<PREditModalAPI> = Symbol('PREditModalAPI');

export function usePREditModal(emit: (event: 'close') => void): PREditModalAPI {
  const { myPassiveRadiators } = useApp();
  const project = useFocusedProject();

  const radiator = computed(() => {
    void projectChanged.value;
    return project.value.box.passiveRadiator.radiator;
  });
  const prFsWithMassShown = computed(() => {
    void projectChanged.value;
    return project.value.box.passiveRadiator.resonanceWithAddedMass_hz.value;
  });
  const count = computed(() => {
    void projectChanged.value;
    return project.value.box.passiveRadiator.count.value;
  });
  const countOptions = NumberField.PR_NUM.countOptions();

  function setCount(v: number): void {
    project.value.box.passiveRadiator.count.set(v);
  }

  function saveCurrentPR(): void {
    myPassiveRadiators.upsert(radiator.value.detach());
  }

  function close(): void {
    emit('close');
  }

  return {
    radiator,
    countOptions,
    prFsWithMassShown,
    count,
    setCount,
    saveCurrentPR,
    close,
    inputValue,
  };
}
