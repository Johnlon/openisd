/**
 * Passive-radiator selection actions (Enclosure tab, PR box type) — loading a saved PR, a bundled
 * catalogue entry (which only publishes Sd/Cms, so the editor opens for the rest), or defining a
 * new one. Skin-neutral: shared by every shell's PR browser/editor header (one implementation,
 * two presentations), rather than each shell re-deriving the same three actions.
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
  const prEditOpen = ref(false);
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
    prEditOpen.value = true;
  }
  function defineNewPREntry() {
    definePassiveRadiator();
    prBrowseOpen.value = false;
    prEditOpen.value = true;
  }
  return { prBrowseOpen, prEditOpen, loadPREntry, loadBundledPassiveRadiatorEntry, defineNewPREntry };
}
