import {computed, ref, type ComputedRef, type Ref} from 'vue';
import type {CrashReports} from './crashReports.js';

export interface CrashScreenHook {
  readonly visible: ComputedRef<boolean>;
  readonly note: Ref<string>;
  readonly contact: Ref<string>;
  send(): void;
  dismiss(): void;
}

export function useCrashScreen(crashReports: CrashReports): CrashScreenHook {
  const note = ref('');
  const contact = ref('');
  return {
    visible: computed(() => crashReports.pending.value !== null),
    note, contact,
    send() {
      crashReports.submit(note.value, contact.value);
      note.value = '';
      contact.value = '';
    },
    dismiss() { crashReports.dismiss(); },
  };
}
