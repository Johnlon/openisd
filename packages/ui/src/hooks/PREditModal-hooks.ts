import type {InjectionKey, Ref} from 'vue';
import {computed, ref} from 'vue';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {passiveRadiatorRows} from '../logic/driverDisplay.js';
import {useApp} from '../logic/app.js';
import {fieldHelp} from '../logic/fields/fieldRegistry.js';
import {inputValue} from '../logic/domEvents.js';

export interface PREditModalAPI {
  readonly radiator: Readonly<Ref<ReturnType<typeof useFocusedProject>['value']['box']['passiveRadiator']['radiator']>>;
  readonly prFsWithMassShown: Readonly<Ref<number | null>>;
  readonly prLib: Ref<ReturnType<typeof passiveRadiatorRows>>;
  readonly showPRLib: Ref<boolean>;
  saveCurrentPR(): void;
  choosePRFromLib(uuid: string): void;
  close(emit: (event: 'close') => void): void;
  fieldHelp(key: string): string;
  inputValue(e: Event): string;
}

export const PREditModalKey: InjectionKey<PREditModalAPI> = Symbol('PREditModalAPI');

export function usePREditModal(emit: (event: 'close') => void): PREditModalAPI {
  const { myPassiveRadiators } = useApp();
  const project = useFocusedProject();

  const radiator = computed(() => project.value.box.passiveRadiator.radiator);
  const prFsWithMassShown = computed(() => project.value.box.passiveRadiator.resonanceWithAddedMass_hz.value);

  const libRows = () => passiveRadiatorRows(
    myPassiveRadiators.list().map(e => ({ id: e.uuid, radiator: e.passiveRadiator })));
  const prLib = ref(libRows());
  const showPRLib = ref(false);

  function saveCurrentPR(): void {
    myPassiveRadiators.upsert(radiator.value.detach());
    prLib.value = libRows();
  }

  function choosePRFromLib(uuid: string): void {
    const entry = myPassiveRadiators.list().find(e => e.uuid === uuid);
    if (entry) {
      radiator.value.update(entry.passiveRadiator);
    }
  }

  function close(): void {
    emit('close');
  }

  return {
    radiator,
    prFsWithMassShown,
    prLib,
    showPRLib,
    saveCurrentPR,
    choosePRFromLib,
    close,
    fieldHelp,
    inputValue,
  };
}
