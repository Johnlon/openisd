import type { InjectionKey, Ref } from 'vue';
import { ref } from 'vue';
import { useApp } from '../logic/app.js';

export interface OgNewProjectAPI {
  readonly selection: ReturnType<typeof useApp>['selection'];
  readonly open: Ref<boolean>;
  close(): void;
}

export const OgNewProjectKey: InjectionKey<OgNewProjectAPI> = Symbol('OgNewProjectAPI');

export function useOgNewProject(): OgNewProjectAPI {
  const { selection } = useApp();
  const open = ref(true);

  function close(): void {
    open.value = false;
  }

  return {
    selection,
    open,
    close,
  };
}
