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
import {OpenISDDriver, OpenISDDriverStandalone, type VoiceCoilWiring} from '@openisd/design';
import {type SelectorOption, VC_CONNECTION_OPTIONS} from '@openisd/design/fields';
import {appContext, engine} from './appState.js';
import type {EditorDraftSeed} from './driverSelection.js';

/** The wiring choices the editor's select lists — the domain's list, reached through logic so no
 *  component names `@openisd/design/fields` itself (the layering gate; same seam as
 *  `environment.ts`'s `lossModeOptions()`). */
export function wiringOptions(): readonly SelectorOption<VoiceCoilWiring>[] {
  return VC_CONNECTION_OPTIONS;
}

export interface DriverDraft {
  /** The driver being edited. A detached copy: writing to it changes nothing else until the
   *  editor commits. */
  readonly driver: OpenISDDriver;
  /** Throw the edits away and start again from the same seed. */
  reset(): void;
  /** Adopt a driver read from a file as the new draft, replacing what was there. */
  replace(driver: OpenISDDriver): void;
  /** Set the coil wiring. The select's option list (`VC_CONNECTION_OPTIONS`) carries the domain's
   *  own wiring values, so the chosen option is written as-is — nothing to map. */
  setWiring(choice: VoiceCoilWiring): void;
  /** Whether the draft currently derives unknowns. Every seed this session ever holds is a
   *  detached `OpenISDDriverStandalone` — reads `true` only if that narrowing ever stopped
   *  holding, which would itself be a bug elsewhere worth seeing rather than masking. */
  readonly autoCalculate: boolean;
  /** OFF freezes every field at its current value until turned back ON — WinISD's own "Auto
   *  calculate unknowns", scoped to this editing session only. */
  setAutoCalculate(enabled: boolean): void;
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
    return subject.seed ? subject.seed.detach() : OpenISDDriver.empty(engine, appContext);
  };

  let current = seedDraft();

  return {
    get driver() { return current; },
    reset() { current = seedDraft(); },
    replace(driver: OpenISDDriver) { current = driver; },
    setWiring(choice: VoiceCoilWiring) {
      const d = current;
      d.specs.VCCon.set(choice);
    },
    get autoCalculate() {
      return current instanceof OpenISDDriverStandalone ? current.autoCalculate : true;
    },
    setAutoCalculate(enabled: boolean) {
      if (current instanceof OpenISDDriverStandalone) current.setAutoCalculate(enabled);
    },
  };
}
