/**
 * `MobileShell.vue`'s hook — routing between the Design tabs and the full-screen Graph
 * destination, plus the manual skin switch and the no-project empty state. One hook, one
 * component (`.claude/rules/ui.md`); every ref/computed/write lives here.
 */
import {computed, ref} from 'vue';
import {focusedProject, isModified, resetProjectToGround} from '../logic/appState.js';
import {presentationState, setSkinOverride} from '../logic/presentationState.js';
import {useApp} from '../logic/app.js';
import {inputFrom} from '../logic/domEvents.js';
import {injectSplashModal} from './SplashModal-hooks.js';
import type {TabId} from './OriginalShell-hooks.js';

/** The mobile shell's own destinations: the same tab ids the desktop shell's content panel
 *  uses (so a shared field-wiring caller never has to ask "which shell is this"), plus `graph`
 *  — a destination that has no desktop counterpart, because `GraphPanel`'s canvas sets
 *  `touch-action: none` (custom pointer pan/zoom) and would trap vertical scroll if it sat
 *  inline in a form column instead of owning the whole screen. */
export type MobileDestination = Extract<TabId, 'box' | 'driver' | 'signal'> | 'graph';

export interface MobileShellApi {
  projectOpen: import('vue').ComputedRef<boolean>;
  destination: import('vue').Ref<MobileDestination>;
  fileInput: import('vue').Ref<HTMLInputElement | null>;
  openImportedFile: (e: Event) => void;
  openNewProject: () => void;
  switchToDesktop: () => void;
  menuOpen: import('vue').Ref<boolean>;
  toggleMenu: () => void;
  closeMenu: () => void;
  openFromDisk: () => void;
  isModified: import('vue').ComputedRef<boolean>;
  saveProject: () => Promise<unknown>;
  revertProject: () => void;
  browseDrivers: () => void;
  optionsOpen: import('vue').Ref<boolean>;
  openOptions: () => void;
  about: () => void;
}

export function useMobileShell(): MobileShellApi {
  const { designIO } = useApp();
  const { saveProject } = designIO;
  const { show: about } = injectSplashModal();
  const projectOpen = computed(() => focusedProject() != null);
  const destination = ref<MobileDestination>('box');

  const fileInput = ref<HTMLInputElement | null>(null);
  function openImportedFile(e: Event): void {
    const input = inputFrom(e);
    if (input === null) return;
    const f = input.files?.[0];
    if (f) designIO.importFile(f);
    input.value = '';
  }
  function openNewProject(): void {
    presentationState.newProjectOpen = true;
    closeMenu();
  }
  function openFromDisk(): void {
    fileInput.value?.click();
    closeMenu();
  }

  async function confirmDiscard(): Promise<boolean> {
    return globalThis.confirm('Discard all unsaved changes and return to the last saved version?');
  }
  function revertProject(): void {
    if (isModified.value) resetProjectToGround(confirmDiscard);
    closeMenu();
  }

  function browseDrivers(): void {
    presentationState.browseOpen = true;
    closeMenu();
  }

  const optionsOpen = ref(false);
  function openOptions(): void { optionsOpen.value = true; closeMenu(); }

  // The hamburger menu — the mobile shell's stand-in for the desktop toolbar, since there's
  // no room for individual icons at phone width. Everything it opens (Options, Driver browser,
  // the New Project wizard, Export) is the SAME modal/state the desktop toolbar drives; this
  // just gives mobile a way to reach it.
  const menuOpen = ref(false);
  function toggleMenu(): void { menuOpen.value = !menuOpen.value; }
  function closeMenu(): void { menuOpen.value = false; }

  // The Info menu's manual skin switch — the auto-by-viewport half lives in `App.vue`'s
  // `activeSkin` (`presentationState.narrowViewport`), which this override beats. Symmetric with
  // `OriginalShell-hooks.ts`'s `switchToMobile`.
  function switchToDesktop(): void { setSkinOverride('original'); closeMenu(); }

  return {
    projectOpen, destination, fileInput, openImportedFile, openNewProject, switchToDesktop,
    menuOpen, toggleMenu, closeMenu, openFromDisk, isModified,
    saveProject, revertProject, browseDrivers, optionsOpen, openOptions, about,
  };
}
