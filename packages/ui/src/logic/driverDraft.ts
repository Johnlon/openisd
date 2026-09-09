/**
 * The driver editor's editing session — Layer 3 of the editor's layered memory: a DETACHED
 * driver, isolated from the design until OK.
 *
 * It lives here rather than in `DriverEditorModal.vue` because constructing, detaching and
 * committing a driver is logic, not presentation (John, 2026-09-09: "the dep can be moved to
 * the logic like I've instructed"). The component asks for a draft, reads and writes fields
 * through the handle, and asks to commit; it never names `OpenISDDriver` or the domain's
 * wiring enum.
 */
import { OpenISDDriver, VoiceCoilWiring } from '@openisd/design';
import { engine } from './appState.js';
import type { EditorDraftSeed } from './driverSelection.js';

/** How a voice coil's two windings are joined, in the UI's own words. The domain enum is
 *  `VoiceCoilWiring`; this is the string a `<select>` holds, mapped here so no component
 *  imports the enum. */
export type WiringChoice = 'series' | 'parallel';

export interface DriverDraft {
  /** The driver being edited. A detached copy: writing to it changes nothing else until the
   *  editor commits. */
  readonly driver: OpenISDDriver;
  /** Throw the edits away and start again from the same seed. */
  reset(): void;
  /** Adopt a driver read from a file as the new draft, replacing what was there. */
  replace(driver: OpenISDDriver): void;
  /** Set the coil wiring from the UI's word for it. */
  setWiring(choice: WiringChoice): void;
}

/** Open an editing session on `subject`.
 *
 *  The seed differs by subject: a My Driver's picked driver, a blank driver for a fresh My
 *  Driver (`seed: null`), or — for the project subject — the caller's own driver, since the
 *  project is not reachable from here. */
export function openDriverDraft(
  subject: EditorDraftSeed,
  projectDriver?: () => OpenISDDriver,
): DriverDraft {
  const seedDraft = (): OpenISDDriver => {
    if (subject.kind === 'project') {
      if (!projectDriver) {
        throw new Error('openDriverDraft: a project subject needs the project driver to seed from');
      }
      return projectDriver().detach();
    }
    return subject.seed ? subject.seed.detach() : OpenISDDriver.empty(engine);
  };

  let current = seedDraft();

  return {
    get driver() { return current; },
    reset() { current = seedDraft(); },
    replace(driver: OpenISDDriver) { current = driver; },
    setWiring(choice: WiringChoice) {
      const d = current;
      d.spec[d.section].VCCon.set(
        choice === 'series' ? VoiceCoilWiring.Series : VoiceCoilWiring.Parallel);
    },
  };
}
