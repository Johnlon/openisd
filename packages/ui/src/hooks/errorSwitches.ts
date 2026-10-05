import {computed} from 'vue';
import type {ComputedRef, Ref} from 'vue';
import type {OpenISDProject} from '@openisd/design';

/** The project's error switches (which controls carry the warning look, whether each applies,
 *  whether it is reproducing the error), re-read when the project changes. Both shells' Advanced
 *  panes read the same one. */
export function createErrorSwitches(d: {
  project: Readonly<Ref<OpenISDProject>>;
  projectChanged: Readonly<Ref<number>>;
}): ComputedRef<OpenISDProject['errorSwitches']> {
  return computed(() => {
    void d.projectChanged.value;
    return d.project.value.errorSwitches;
  });
}

