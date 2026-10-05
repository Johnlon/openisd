import type {InjectionKey, ShallowRef} from 'vue';
import {inject, provide, shallowRef} from 'vue';
import type {CompatSwitchGroup, WinisdDeviation} from '@openisd/design/fields';
import {WinisdDifference, WinisdDifferenceSection} from '@openisd/design/fields';

/** Where the page opens: a section, an entry, or (null) the top. */
export type WinisdDifferencesTarget = WinisdDifference | WinisdDifferenceSection;

export interface WinisdDifferencesModalAPI {
  readonly open: ShallowRef<boolean>;
  readonly sections: readonly WinisdDifferenceSection[];
  /** The section or entry the page scrolls to; null opens it at the top. */
  readonly target: ShallowRef<WinisdDifferencesTarget | null>;
  /** The Help menu's "OpenISD and WinISD differences": the page at the top. */
  show(): void;
  /** A WinISD Compatibility group heading's help link: the page at the group's section. */
  showGroup(g: CompatSwitchGroup): void;
  /** A ≠W cue's "More…": the page at the cue's entry. */
  showDeviation(d: WinisdDeviation): void;
  close(): void;
}

export const WinisdDifferencesModalKey: InjectionKey<WinisdDifferencesModalAPI> = Symbol('WinisdDifferencesModalAPI');

/**
 * The help page "OpenISD and WinISD differences". Shallow refs: the entries are design-layer
 * class instances with private fields, which a deep reactive proxy cannot read.
 */
export function useWinisdDifferencesModal(): WinisdDifferencesModalAPI {
  const open = shallowRef(false);
  const target = shallowRef<WinisdDifferencesTarget | null>(null);

  function openAt(t: WinisdDifferencesTarget | null): void {
    target.value = t;
    open.value = true;
  }

  return {
    open,
    sections: WinisdDifferenceSection.ALL,
    target,
    show: () => openAt(null),
    showGroup: g => openAt(WinisdDifferenceSection.forGroup(g)),
    showDeviation: d => openAt(WinisdDifference.forDeviation(d)),
    close: () => { open.value = false; target.value = null; },
  };
}

/** Build the app's one help page and hand it to every descendant. Called by `App.vue`; the menus,
 *  the group headings, the ≠W cues and the page itself read that one instance. */
export function provideWinisdDifferencesModal(): WinisdDifferencesModalAPI {
  const api = useWinisdDifferencesModal();
  provide(WinisdDifferencesModalKey, api);
  return api;
}

export function injectWinisdDifferencesModal(): WinisdDifferencesModalAPI {
  const api = inject(WinisdDifferencesModalKey);
  if (!api) throw new Error('WinisdDifferencesModal: no provider — App.vue must call provideWinisdDifferencesModal()');
  return api;
}
