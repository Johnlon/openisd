import type {InjectionKey, Ref} from 'vue';
import {ref} from 'vue';
import {useApp} from '../logic/app.js';

export interface OgProjectListAPI {
  readonly projectRepo: ReturnType<typeof useApp>['projectRepo'];
  readonly focusedId: Readonly<Ref<string | null>>;
  selectProject(id: string): void;
  closeProject(id: string): void;
}

export const OgProjectListKey: InjectionKey<OgProjectListAPI> = Symbol('OgProjectListAPI');

export function useOgProjectList(): OgProjectListAPI {
  const { projectRepo } = useApp();
  const focusedId = ref<string | null>(null);

  function selectProject(id: string): void {
    focusedId.value = id;
  }

  function closeProject(_id: string): void {
    // Project closing logic delegated to app state
  }

  return {
    projectRepo,
    focusedId,
    selectProject,
    closeProject,
  };
}
