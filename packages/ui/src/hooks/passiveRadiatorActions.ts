/**
 * Passive-radiator actions on the PR page (Enclosure tab, PR box type) — loading a saved PR or a
 * bundled catalogue entry, defining a new one, and saving a copy of the page's PR to My passive
 * radiators under a name confirmed in a dialog.
 * Skin-neutral: shared by every shell's PR page (one implementation, two presentations).
 * Every PR field, the name included, is edited on the page itself; there is no separate editor.
 */
import {computed, ref} from 'vue';
import type {ComputedRef} from 'vue';
import {definePassiveRadiator} from '../logic/appState.js';
import type {OpenISDProject} from '@openisd/design';
import type {SaveToLibraryField} from './saveToLibraryField.js';
import type {BundledPassiveRadiatorRepo, MyPassiveRadiatorRepo} from '@openisd/persistence';

export interface PassiveRadiatorActionsDeps {
  project: ComputedRef<OpenISDProject>;
  myPassiveRadiators: MyPassiveRadiatorRepo;
  bundledPassiveRadiators: BundledPassiveRadiatorRepo;
}

export function createPassiveRadiatorActions({ project, myPassiveRadiators, bundledPassiveRadiators }: PassiveRadiatorActionsDeps) {
  const prBrowseOpen = ref(false);
  function loadPREntry(uuid: string) {
    const entry = myPassiveRadiators.list().find(e => e.uuid === uuid);
    if (!entry) return;
    project.value.box.passiveRadiator.configurePR(entry.passiveRadiator);
    prBrowseOpen.value = false;
  }
  async function loadBundledPassiveRadiatorEntry(uuid: string): Promise<void> {
    const pr = await bundledPassiveRadiators.load(uuid);
    project.value.box.passiveRadiator.configurePR(pr);
    prBrowseOpen.value = false;
  }
  function defineNewPREntry() {
    definePassiveRadiator();
    prBrowseOpen.value = false;
  }
  // ---- Save to library: a dialog confirms the name, then a detached copy is saved -------------
  // John, 2026-10-05: the dialog's name names only the library entry. The project's radiator is
  // never touched; the saved entry is a deep copy, so later edits to either leave the other alone.
  // Entries are keyed by identity, not name (as My Drivers, QO81): a name already in the library
  // saves a second entry beside it and overwrites nothing.
  const prSaveOpen = ref(false);
  const prSaveName = ref('');
  const prSaveCanSave = computed(() => prSaveName.value.trim() !== '');
  const prSaveFields: readonly SaveToLibraryField[] = [
    { label: 'Name', placeholder: 'Passive radiator name', text: prSaveName, inputClass: 'pr-save-name' },
  ];
  function openPRSave(): void {
    prSaveName.value = project.value.box.passiveRadiator.radiator.model.value;
    prSaveOpen.value = true;
  }
  function cancelPRSave(): void {
    prSaveOpen.value = false;
  }
  function confirmPRSave(): void {
    if (!prSaveCanSave.value) return;
    const copy = project.value.box.passiveRadiator.radiator.detach();
    copy.model.set(prSaveName.value.trim());
    myPassiveRadiators.upsert(copy);
    prSaveOpen.value = false;
  }
  return {
    prBrowseOpen, loadPREntry, loadBundledPassiveRadiatorEntry, defineNewPREntry,
    prSaveOpen, prSaveName, prSaveFields, prSaveCanSave, openPRSave, cancelPRSave, confirmPRSave,
  };
}
