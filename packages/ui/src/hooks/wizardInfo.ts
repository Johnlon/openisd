/**
 * The wizard's ⓘ popups (Placement, EBP), shared by the phone and desktop New project dialogs:
 * which popup is open and its card. The words are `PhoneWizardText` in packages/design.
 */
import type {Ref} from 'vue';
import {computed, ref} from 'vue';
import {PhoneWizardText, type WizardInfoCard} from '@openisd/design/fields';
import {useEscToClose} from '../logic/useEscToClose.js';

type WizardInfoKind = 'placement' | 'ebp';

export function createWizardInfo(ebpText: Ref<string>) {
  const info = ref<WizardInfoKind | null>(null);
  useEscToClose(() => info.value !== null, () => { info.value = null; });
  const infoCard = computed<WizardInfoCard | null>(() => {
    switch (info.value) {
      case 'placement': return PhoneWizardText.PLACEMENT_INFO;
      case 'ebp': return PhoneWizardText.ebpInfo(ebpText.value);
      case null: return null;
    }
  });
  return {
    infoCard,
    openPlacementInfo: (): void => { info.value = 'placement'; },
    openEbpInfo: (): void => { info.value = 'ebp'; },
    closeInfo: (): void => { info.value = null; },
  };
}
