/**
 * The desktop skin's help: which sections the open help panel shows, and the sections each band's
 * and tab's ? opens. The words are `DesktopHelp` / `PhoneHelp` in packages/design.
 */
import type {Ref} from 'vue';
import {computed, shallowRef} from 'vue';
import {DesktopHelp, type PhoneHelpSection} from '@openisd/design/fields';
import type {BoxType} from '@openisd/design/engine';
import type {TabId} from '../logic/tabId.js';
import type {FeatureUse} from '../logic/telemetry/featureUse.js';

/** What the open help panel shows: its title and its sections. */
export interface HelpPanelContent {
  readonly title: string;
  readonly sections: readonly PhoneHelpSection[];
}

interface DesktopHelpDeps {
  activeTab: Ref<TabId>;
  selectedBox: Ref<BoxType>;
  featureUse: FeatureUse;
}

export function createDesktopHelp({activeTab, selectedBox, featureUse}: DesktopHelpDeps) {
  const panel = shallowRef<HelpPanelContent | null>(null);

  function openSection(section: PhoneHelpSection): void {
    featureUse.feature('help');
    panel.value = {title: section.title, sections: [section]};
  }

  /** The tabs with no bands (Filters, Advanced, Project) get one ? that explains the whole tab. */
  const tabSections = computed<readonly PhoneHelpSection[]>(() => {
    switch (activeTab.value) {
      case 'filters': return DesktopHelp.FILTERS_TAB;
      case 'advanced': return DesktopHelp.ADVANCED_TAB;
      case 'project': return DesktopHelp.PROJECT_TAB;
      case 'box':
      case 'driver':
      case 'enclosure':
      case 'signal': return [];
    }
  });

  function openTab(): void {
    const sections = tabSections.value;
    const first = sections[0];
    if (first === undefined) return;
    featureUse.feature('help');
    panel.value = {title: sections.length === 1 ? first.title : activeTab.value, sections};
  }

  return {
    helpPanel: panel,
    closeHelp: (): void => { panel.value = null; },
    openSectionHelp: openSection,
    openTabHelp: openTab,
    tabHelpShown: computed(() => tabSections.value.length > 0),
    rearChamberHelp: computed(() => DesktopHelp.rearChamber(selectedBox.value)),
    frontChamberHelp: DesktopHelp.FRONT_CHAMBER,
    passiveRadiatorHelp: DesktopHelp.PASSIVE_RADIATOR,
    userOptionsHelp: DesktopHelp.USER_OPTIONS,
    placementHelp: DesktopHelp.PLACEMENT,
    advancedOptionsHelp: DesktopHelp.ADVANCED_OPTIONS,
    listeningPlaceHelp: DesktopHelp.LISTENING_PLACE,
    signalSourceHelp: DesktopHelp.SIGNAL_SOURCE,
    limitsHelp: DesktopHelp.LIMITS,
    ventHelp: DesktopHelp.ventSection,
  };
}
