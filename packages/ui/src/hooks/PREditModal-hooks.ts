import type {InjectionKey, Ref} from 'vue';
import {computed, ref} from 'vue';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {passiveRadiatorRows} from '../logic/driverDisplay.js';
import {useApp} from '../logic/app.js';
import {fieldHelp} from '../logic/fields/uiFields.js';
import {inputValue} from '../logic/domEvents.js';

export interface PREditModalAPI {
  readonly radiator: Readonly<Ref<ReturnType<typeof useFocusedProject>['value']['box']['passiveRadiator']['radiator']>>;
  readonly prFsWithMassShown: Readonly<Ref<number | null>>;
  readonly prLib: Ref<ReturnType<typeof passiveRadiatorRows>>;
  readonly showPRLib: Ref<boolean>;
  readonly count: Readonly<Ref<number>>;
  setCount(v: number): void;
  saveCurrentPR(): void;
  loadPR(uuid: string): void;
  removePR(uuid: string): void;
  choosePRFromLib(uuid: string): void;
  close(): void;
  fieldHelp(key: string): string;
  inputValue(e: Event): string;
}

export const PREditModalKey: InjectionKey<PREditModalAPI> = Symbol('PREditModalAPI');

export function usePREditModal(emit: (event: 'close') => void): PREditModalAPI {
  const { myPassiveRadiators } = useApp();
  const project = useFocusedProject();

  const radiator = computed(() => project.value.box.passiveRadiator.radiator);
  const prFsWithMassShown = computed(() => project.value.box.passiveRadiator.resonanceWithAddedMass_hz.value);
  const count = computed(() => project.value.box.passiveRadiator.count.value);

  const libRows = () => passiveRadiatorRows(
    myPassiveRadiators.list().map(e => ({ id: e.uuid, radiator: e.passiveRadiator })));
  const prLib = ref(libRows());
  const showPRLib = ref(false);

  function setCount(v: number): void {
    project.value.box.passiveRadiator.count.set(v);
  }

  function saveCurrentPR(): void {
    myPassiveRadiators.upsert(radiator.value.detach());
    prLib.value = libRows();
  }

  function loadPR(uuid: string): void {
    const entry = myPassiveRadiators.list().find(e => e.uuid === uuid);
    if (!entry) return;
    project.value.box.passiveRadiator.configurePR(entry.passiveRadiator);
    showPRLib.value = false;
  }

  function removePR(uuid: string): void {
    myPassiveRadiators.remove(uuid);
    prLib.value = libRows();
  }

  function choosePRFromLib(uuid: string): void {
    loadPR(uuid);
  }

  function close(): void {
    emit('close');
  }

  return {
    radiator,
    prFsWithMassShown,
    prLib,
    showPRLib,
    count,
    setCount,
    saveCurrentPR,
    loadPR,
    removePR,
    choosePRFromLib,
    close,
    fieldHelp,
    inputValue,
  };
}
