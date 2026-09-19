import type {InjectionKey, Ref} from 'vue';
import {computed} from 'vue';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import type {OpenISDProject} from '@openisd/design';
import type {BoxType} from '@openisd/design/engine';

export interface OgEnclosureAPI {
  readonly project: Readonly<Ref<OpenISDProject>>;
  readonly boxType: Readonly<Ref<string>>;
  setBoxType(type: BoxType): void;
}

export const OgEnclosureKey: InjectionKey<OgEnclosureAPI> = Symbol('OgEnclosureAPI');

export function useOgEnclosure(): OgEnclosureAPI {
  const project = useFocusedProject();
  const boxType = computed(() => project.value.box.boxType.get());

  function setBoxType(type: BoxType): void {
    project.value.box.boxType.set(type);
  }

  return {
    project,
    boxType,
    setBoxType,
  };
}
