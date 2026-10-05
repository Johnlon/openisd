/**
 * Passive-radiator actions on the PR page (Enclosure tab, PR box type) — loading a saved PR or a
 * bundled catalogue entry, defining a new one, and saving the page's PR to My passive radiators.
 * Skin-neutral: shared by every shell's PR page (one implementation, two presentations).
 * Every PR field, the name included, is edited on the page itself; there is no separate editor.
 */
import {ref} from 'vue';
import type {ComputedRef} from 'vue';
import {definePassiveRadiator} from '../logic/appState.js';
import type {OpenISDProject} from '@openisd/design';
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
  /** Saves the project's passive radiator to My passive radiators under its current name. */
  function saveToLibrary(): void {
    myPassiveRadiators.upsert(project.value.box.passiveRadiator.radiator.detach());
  }
  return { prBrowseOpen, loadPREntry, loadBundledPassiveRadiatorEntry, defineNewPREntry, saveToLibrary };
}
