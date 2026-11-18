import {computed, ref, type ComputedRef, type Ref} from 'vue';
import {saveButtonState, savedMessage, type SaveButtonState} from '@openisd/design/fields';
import {saveTooltip} from '@openisd/design/cloud';
import {useCloudSyncOn} from './UnsavedNudge-hooks.js';
import {useApp} from '../logic/app.js';

/** How long the "Saved" note stays beside the button. */
const NOTE_MS = 2000;

export interface MobileSaveButtonApi {
  state: ComputedRef<SaveButtonState>;
  /** The "Saved <name>" note, or '' when none is showing. */
  note: Readonly<Ref<string>>;
  /** Saves the open project under its current name, then says so. */
  save: () => Promise<void>;
}

export function useMobileSaveButton(): MobileSaveButtonApi {
  const { appState, designIO } = useApp();
  const syncOn = useCloudSyncOn();
  const state = computed(() => {
    const usual = saveButtonState(appState.isModified.value);
    // With Cloud sync on, a lit button says what saving does for sync; a saved one still says "Saved".
    return usual.lit ? {...usual, title: saveTooltip(syncOn.value, usual.title)} : usual;
  });
  const note = ref('');
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function save(): Promise<void> {
    const saved = await designIO.saveProject();
    if (!saved) return;
    note.value = savedMessage(appState.focusedProject()?.title() ?? '');
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => { note.value = ''; }, NOTE_MS);
  }
  return { state, note, save };
}
